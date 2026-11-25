// The text helper of the views: it lets a long machine value wrap at a readable place.
//
// A name, an address, or a path holds no space, so a narrow cell either cuts it or breaks
// it in the middle of a word. The console shows every value whole, therefore a separator
// of the value offers a line break.

/**
 * The places where a machine value can break: after an at sign, after a colon, an
 * underscore, a comma or an equals sign inside a word, after a hyphen that follows a
 * character, and after a dot or a slash that comes before a letter. An IPv4 address and a
 * CIDR block therefore hold no break.
 */
const SEPARATOR = /(?<=@|[\w][:_,=-])(?=[\w/])|(?<=\w[./])(?=[A-Za-z_])/;

/** breakPoints returns the parts of a value, where a line can break between two parts. */
export function breakPoints(value) {
  return String(value).split(SEPARATOR);
}

/**
 * appendBreakable appends a value to a node with a break opportunity after each separator.
 * The text of the node stays the value itself, so a copy holds no extra character.
 */
export function appendBreakable(node, value) {
  breakPoints(value).forEach((part, index) => {
    if (index > 0) {
      node.append(document.createElement("wbr"));
    }
    node.append(document.createTextNode(part));
  });
  return node;
}
