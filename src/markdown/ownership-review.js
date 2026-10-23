import { blockLabel, isRestorable, readDetachments } from "./source-patch.js";
import { serializeBlock } from "./serialize.js";

const source = (block) => {
  try {
    return serializeBlock(block);
  } catch {
    throw Error("The visual version cannot be serialized safely.");
  }
};

const plan = (current, proposedBlock, recordId, label, kind) => ({
  targetBlockId: current.id,
  recordId,
  label,
  kind,
  original: source(current),
  proposed: source(proposedBlock),
  proposedBlock: structuredClone(proposedBlock),
});

export function ownershipReviewForEdit(draft, openedBlock, proposedBlock) {
  const current = draft.blocks.find((block) => block.id === openedBlock.id);
  if (
    current &&
    current.type === openedBlock.type &&
    source(current) === source(openedBlock)
  )
    return null;
  if (current)
    return plan(
      current,
      proposedBlock,
      null,
      blockLabel(openedBlock),
      openedBlock.type === "component" ? "component" : "builder",
    );

  const record = readDetachments(draft.metadata).findLast(
    (item) =>
      item.previousBlockIds.includes(openedBlock.id) &&
      draft.blocks.some((block) => block.id === item.blockId),
  );
  if (!record || !isRestorable(record))
    throw Error(
      "This visual section was detached or removed. Its Markdown remains unchanged; reopen the current section.",
    );
  return plan(
    draft.blocks.find((block) => block.id === record.blockId),
    proposedBlock,
    record.id,
    record.labels[0] || blockLabel(openedBlock),
    record.kinds[0],
  );
}

export function ownershipReviewForRecord(draft, recordId) {
  const record = readDetachments(draft.metadata).find(
    (item) => item.id === recordId,
  );
  if (!record) throw Error("This Detachment record is no longer available.");
  if (!isRestorable(record))
    throw Error(
      "This Detachment record is not Restorable. Keep the current Markdown or use Undo when it is still available.",
    );
  if (
    (record.kinds[0] === "component" && record.previous.type !== "component") ||
    (record.kinds[0] === "builder" &&
      ["component", "custom"].includes(record.previous.type))
  )
    throw Error("This Detachment record has an invalid visual version.");
  const current = draft.blocks.find((block) => block.id === record.blockId);
  if (!current)
    throw Error("This detached section is no longer available for review.");
  return plan(
    current,
    record.previous,
    record.id,
    record.labels[0] || blockLabel(record.previous),
    record.kinds[0],
  );
}

export function refreshOwnershipReview(draft, review) {
  const current = draft.blocks.find(
    (block) => block.id === review.targetBlockId,
  );
  if (!current)
    throw Error(
      "The reviewed section changed again. Close Ownership review and reopen the current section.",
    );
  return {
    ...review,
    original: source(current),
    proposed: source(review.proposedBlock),
  };
}

export function applyOwnershipReview(draft, review) {
  const blocks = structuredClone(draft.blocks);
  const index = blocks.findIndex((block) => block.id === review.targetBlockId);
  if (index < 0)
    throw Error(
      "The reviewed section changed again. Nothing was applied; reopen the current section.",
    );
  const current = blocks[index];
  const proposed = structuredClone(review.proposedBlock);
  if (
    blocks.some(
      (block, blockIndex) => blockIndex !== index && block.id === proposed.id,
    )
  )
    throw Error(
      "The visual version conflicts with another section identity. Nothing was applied.",
    );
  if (current.separator === undefined) delete proposed.separator;
  else proposed.separator = current.separator;
  blocks[index] = proposed;

  const metadata = { ...draft.metadata };
  if (review.recordId && Array.isArray(metadata.detachments))
    metadata.detachments = metadata.detachments.filter(
      (record) => record?.id !== review.recordId,
    );
  return { blocks, metadata };
}
