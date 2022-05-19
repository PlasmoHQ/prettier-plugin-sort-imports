import type {
    EmptyStatement,
    ImportDeclaration,
    ImportDefaultSpecifier,
    ImportNamespaceSpecifier,
    ImportSpecifier,
} from '@babel/types';
import assert from 'assert';

import {
    importFlavorRegular,
    importFlavorType,
    mergeableImportFlavors,
} from '../constants';
import type { MergeNodesWithMatchingImportFlavors } from '../types';
import { getImportFlavorOfNode } from './get-import-flavor-of-node';

type MergeableFlavor = typeof mergeableImportFlavors[number];
function isMergeableFlavor(flavor: string): flavor is MergeableFlavor {
    return mergeableImportFlavors.includes(flavor as MergeableFlavor);
}

function selectMergeableNodesByImportFlavor(
    nodes: ImportDeclaration[],
): Record<MergeableFlavor, ImportDeclaration[]> {
    return nodes.reduce(
        (groups, node) => {
            const flavor = getImportFlavorOfNode(node);
            if (isMergeableFlavor(flavor)) {
                groups[flavor].push(node);
            }
            return groups;
        },
        {
            [importFlavorRegular]: [] as ImportDeclaration[],
            [importFlavorType]: [] as ImportDeclaration[],
        },
    );
}

function selectNodeImportSource(node: ImportDeclaration) {
    return node.source.value;
}

function nodeIsImportNamespaceSpecifier(
    node: ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier,
): node is ImportNamespaceSpecifier {
    return node.type === 'ImportNamespaceSpecifier';
}
function nodeIsImportDefaultSpecifier(
    node: ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier,
): node is ImportDefaultSpecifier {
    return node.type === 'ImportDefaultSpecifier';
}
function nodeIsImportSpecifier(
    node: ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier,
): node is ImportSpecifier {
    return node.type === 'ImportSpecifier';
}

function convertImportSpecifierType(node: ImportSpecifier) {
    assert(node.importKind === 'value' || node.importKind === 'type');
    node.importKind = 'type';
}

/** Pushes an `import type` expression into `import { type …}` */
function convertTypeImportToValueImport(node: ImportDeclaration) {
    assert(node.importKind === 'type');
    node.importKind = 'value';
    node.specifiers
        .filter(nodeIsImportSpecifier)
        .forEach(convertImportSpecifierType);
}

/** Return false if the merge will produce an invalid result */
function mergeIsSafe(
    nodeToKeep: ImportDeclaration,
    nodeToForget: ImportDeclaration,
) {
    if (
        nodeToKeep.specifiers.some(nodeIsImportNamespaceSpecifier) ||
        nodeToForget.specifiers.some(nodeIsImportNamespaceSpecifier)
    ) {
        // An `import * as Foo` namespace specifier cannot be merged
        //   with other import expressions.
        return false;
    }
    if (
        nodeToKeep.specifiers.some(nodeIsImportDefaultSpecifier) &&
        nodeToForget.specifiers.some(nodeIsImportDefaultSpecifier)
    ) {
        // Two `import Foo from` specifiers cannot be merged trivially.
        // -- Notice: this is *not* import {default as Foo1, default as Foo2} -- that's legal!
        //
        // Future work could convert `import Foo1 from 'a'; import Foo2 from 'a';
        //  into `import {default as Foo1, default as Foo2} from 'a';`
        // But since this runs the risk of making code longer, this won't be in v1.
        return false;
    }
    return true;
}

/**
 * @returns (true to delete node | false to keep node)
 */
function mergeNodes(
    nodeToKeep: ImportDeclaration,
    nodeToForget: ImportDeclaration,
) {
    if (!mergeIsSafe(nodeToKeep, nodeToForget)) {
        return false;
    }

    if (
        nodeToKeep.importKind === 'type' &&
        nodeToForget.importKind === 'value'
    ) {
        convertTypeImportToValueImport(nodeToKeep);
    } else if (
        nodeToKeep.importKind === 'value' &&
        nodeToForget.importKind === 'type'
    ) {
        convertTypeImportToValueImport(nodeToForget);
    }

    nodeToKeep.specifiers.push(...nodeToForget.specifiers);

    // The line numbers will be all messed up. Is this a problem?
    nodeToKeep.leadingComments = [
        ...(nodeToKeep.leadingComments || []),
        ...(nodeToForget.leadingComments || []),
    ];
    nodeToKeep.innerComments = [
        ...(nodeToKeep.innerComments || []),
        ...(nodeToForget.innerComments || []),
    ];
    nodeToKeep.trailingComments = [
        ...(nodeToKeep.trailingComments || []),
        ...(nodeToForget.trailingComments || []),
    ];

    return true;
}

/**
 * Modifies context, deleteContext,
 * case A: context has no node for an import source, then it's assigned.
 * case B: context has a node for an import source, then it's merged, and old node is added to deleteContext.
 */
function mutateContextAndMerge({
    context,
    deleteContext,
    insertableNode,
}: {
    context: Record<string, ImportDeclaration>;
    deleteContext: ImportDeclaration[];
    insertableNode: ImportDeclaration;
}) {
    const source = selectNodeImportSource(insertableNode);
    if (context[source]) {
        if (mergeNodes(context[source], insertableNode)) {
            deleteContext.push(insertableNode);
        }
    } else {
        context[source] = insertableNode;
    }
}

/**
 * Accepts an array of nodes from a given chunk, and merges candidates that have a matching import-flavor
 *
 * In other words each group will be merged if they have the same source:
 * - `import type` expressions from the same source
 * - `import Name, {a, b}` from the same source
 *
 * `import type {Foo}` expressions won't be converted into `import {type Foo}` or vice versa
 */
export const mergeNodesWithMatchingImportFlavors: MergeNodesWithMatchingImportFlavors =
    (input, { importOrderMergeTypeImportsIntoRegular }) => {
        const nodesToDelete: ImportDeclaration[] = [];

        let context: Record<string, ImportDeclaration> = {};
        const groups = selectMergeableNodesByImportFlavor(input);
        for (const groupKey of mergeableImportFlavors) {
            if (!importOrderMergeTypeImportsIntoRegular) {
                // Reset in loop to avoid unintended merge across variants
                context = {};
            }
            const group = groups[groupKey as keyof typeof groups];

            for (const insertableNode of group) {
                mutateContextAndMerge({
                    context,
                    deleteContext: nodesToDelete,
                    insertableNode,
                });
            }
        }

        return input.filter((n) => !nodesToDelete.includes(n));
    };