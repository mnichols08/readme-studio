# Raw edits detach only the Blocks they touch

Today any raw edit turns the whole draft into one Custom Markdown block, so typing one character in the Preamble drops the settings of every builder section, component and generated section. From Epic 02 on, `Store.raw` works out the one changed range by comparing the old and new Source from both ends (common prefix and suffix, widened so it never splits a `\r\n` pair or a surrogate pair). It then maps that range onto the Blocks' source ranges (`documentSegments`) and replaces only the touched Blocks. One Custom Markdown block that was touched keeps its ID. Touched Owned blocks are merged into a single new Custom Markdown block with a new ID, so a builder form left open on the old ID can no longer overwrite them. Text inserted at a Seam goes into an adjacent Custom Markdown block, or into a new one, and never detaches a neighbour.

We considered a full Markdown diff per Block, and re-parsing edited text back into builder settings. The first costs more on every keystroke and still needs a fallback. The second would silently turn the author's text into settings, which the editing guarantees forbid.

The result must satisfy `serializeBlocks(blocks) === markdown`. If it does not, or anything throws, the old whole-draft behaviour is used. Raw editing is never blocked.

Seams belong to positions. Moving or removing a Block keeps each position's separator. Where a Block's text does not end in a line break and the next Seam is empty, that Seam becomes a blank line. The Seam lies inside the move's Edited scope, so no bytes outside the edit change.
