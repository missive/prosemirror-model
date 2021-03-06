var ref = require("./diff");
var findDiffStart = ref.findDiffStart;
var findDiffEnd = ref.findDiffEnd;

// ::- Fragment is the type used to represent a node's collection of
// child nodes.
//
// Fragments are persistent data structures. That means you should
// _not_ mutate them or their content, but create new instances
// whenever needed. The API tries to make this easy.
var Fragment = function(content, size) {
  var this$1 = this;

  this.content = content
  this.size = size || 0
  if (size == null) { for (var i = 0; i < content.length; i++)
    { this$1.size += content[i].nodeSize } }
};

var prototypeAccessors = { firstChild: {},lastChild: {},childCount: {} };

Fragment.prototype.nodesBetween = function (from, to, f, nodeStart, parent) {
    var this$1 = this;

  for (var i = 0, pos = 0; pos < to; i++) {
    var child = this$1.content[i], end = pos + child.nodeSize
    if (end > from && f(child, nodeStart + pos, parent, i) !== false && child.content.size) {
      var start = pos + 1
      child.nodesBetween(Math.max(0, from - start),
                         Math.min(child.content.size, to - start),
                         f, nodeStart + start)
    }
    pos = end
  }
};

// : (number, number, ?string, ?string) → string
Fragment.prototype.textBetween = function (from, to, blockSeparator, leafText) {
  var text = "", separated = true
  this.nodesBetween(from, to, function (node, pos) {
    if (node.isText) {
      text += node.text.slice(Math.max(from, pos) - pos, to - pos)
      separated = !blockSeparator
    } else if (node.isLeaf && leafText) {
      text += leafText
      separated = !blockSeparator
    } else if (!separated && node.isBlock) {
      text += blockSeparator
      separated = true
    }
  }, 0)
  return text
};

// :: (Fragment) → Fragment
// Create a new fragment containing the content of this fragment and
// `other`.
Fragment.prototype.append = function (other) {
  if (!other.size) { return this }
  if (!this.size) { return other }
  var last = this.lastChild, first = other.firstChild, content = this.content.slice(), i = 0
  if (last.isText && last.sameMarkup(first)) {
    content[content.length - 1] = last.withText(last.text + first.text)
    i = 1
  }
  for (; i < other.content.length; i++) { content.push(other.content[i]) }
  return new Fragment(content, this.size + other.size)
};

// :: (number, ?number) → Fragment
// Cut out the sub-fragment between the two given positions.
Fragment.prototype.cut = function (from, to) {
    var this$1 = this;

  if (to == null) { to = this.size }
  if (from == 0 && to == this.size) { return this }
  var result = [], size = 0
  if (to > from) { for (var i = 0, pos = 0; pos < to; i++) {
    var child = this$1.content[i], end = pos + child.nodeSize
    if (end > from) {
      if (pos < from || end > to) {
        if (child.isText)
          { child = child.cut(Math.max(0, from - pos), Math.min(child.text.length, to - pos)) }
        else
          { child = child.cut(Math.max(0, from - pos - 1), Math.min(child.content.size, to - pos - 1)) }
      }
      result.push(child)
      size += child.nodeSize
    }
    pos = end
  } }
  return new Fragment(result, size)
};

Fragment.prototype.cutByIndex = function (from, to) {
  if (from == to) { return Fragment.empty }
  if (from == 0 && to == this.content.length) { return this }
  return new Fragment(this.content.slice(from, to))
};

// :: (number, Node) → Fragment
// Create a new fragment in which the node at the given index is
// replaced by the given node.
Fragment.prototype.replaceChild = function (index, node) {
  var current = this.content[index]
  if (current == node) { return this }
  var copy = this.content.slice()
  var size = this.size + node.nodeSize - current.nodeSize
  copy[index] = node
  return new Fragment(copy, size)
};

// : (Node) → Fragment
// Create a new fragment by prepending the given node to this
// fragment.
Fragment.prototype.addToStart = function (node) {
  return new Fragment([node].concat(this.content), this.size + node.nodeSize)
};

// : (Node) → Fragment
// Create a new fragment by appending the given node to this
// fragment.
Fragment.prototype.addToEnd = function (node) {
  return new Fragment(this.content.concat(node), this.size + node.nodeSize)
};

// :: (Fragment) → bool
// Compare this fragment to another one.
Fragment.prototype.eq = function (other) {
    var this$1 = this;

  if (this.content.length != other.content.length) { return false }
  for (var i = 0; i < this.content.length; i++)
    { if (!this$1.content[i].eq(other.content[i])) { return false } }
  return true
};

// :: ?Node
// The first child of the fragment, or `null` if it is empty.
prototypeAccessors.firstChild.get = function () { return this.content.length ? this.content[0] : null };

// :: ?Node
// The last child of the fragment, or `null` if it is empty.
prototypeAccessors.lastChild.get = function () { return this.content.length ? this.content[this.content.length - 1] : null };

// :: number
// The number of child nodes in this fragment.
prototypeAccessors.childCount.get = function () { return this.content.length };

// :: (number) → Node
// Get the child node at the given index. Raise an error when the
// index is out of range.
Fragment.prototype.child = function (index) {
  var found = this.content[index]
  if (!found) { throw new RangeError("Index " + index + " out of range for " + this) }
  return found
};

// :: (number) → number
// Get the offset at (size of children before) the given index.
Fragment.prototype.offsetAt = function (index) {
    var this$1 = this;

  var offset = 0
  for (var i = 0; i < index; i++) { offset += this$1.content[i].nodeSize }
  return offset
};

// :: (number) → ?Node
// Get the child node at the given index, if it exists.
Fragment.prototype.maybeChild = function (index) {
  return this.content[index]
};

// :: ((node: Node, offset: number, index: number))
// Call `f` for every child node, passing the node, its offset
// into this parent node, and its index.
Fragment.prototype.forEach = function (f) {
    var this$1 = this;

  for (var i = 0, p = 0; i < this.content.length; i++) {
    var child = this$1.content[i]
    f(child, p, i)
    p += child.nodeSize
  }
};

// :: (Fragment) → ?number
// Find the first position at which this fragment and another
// fragment differ, or `null` if they are the same.
Fragment.prototype.findDiffStart = function (other, pos) {
    if ( pos === void 0 ) pos = 0;

  return findDiffStart(this, other, pos)
};

// :: (Node) → ?{a: number, b: number}
// Find the first position, searching from the end, at which this
// fragment and the given fragment differ, or `null` if they are the
// same. Since this position will not be the same in both nodes, an
// object with two separate positions is returned.
Fragment.prototype.findDiffEnd = function (other, pos, otherPos) {
    if ( pos === void 0 ) pos = this.size;
    if ( otherPos === void 0 ) otherPos = other.size;

  return findDiffEnd(this, other, pos, otherPos)
};

// : (number, ?number) → {index: number, offset: number}
// Find the index and inner offset corresponding to a given relative
// position in this fragment. The result object will be reused
// (overwritten) the next time the function is called. (Not public.)
Fragment.prototype.findIndex = function (pos, round) {
    var this$1 = this;
    if ( round === void 0 ) round = -1;

  if (pos == 0) { return retIndex(0, pos) }
  if (pos == this.size) { return retIndex(this.content.length, pos) }
  if (pos > this.size || pos < 0) { throw new RangeError(("Position " + pos + " outside of fragment (" + (this) + ")")) }
  for (var i = 0, curPos = 0;; i++) {
    var cur = this$1.child(i), end = curPos + cur.nodeSize
    if (end >= pos) {
      if (end == pos || round > 0) { return retIndex(i + 1, end) }
      return retIndex(i, curPos)
    }
    curPos = end
  }
};

// :: () → string
// Return a debugging string that describes this fragment.
Fragment.prototype.toString = function () { return "<" + this.toStringInner() + ">" };

Fragment.prototype.toStringInner = function () { return this.content.join(", ") };

// :: () → ?Object
// Create a JSON-serializeable representation of this fragment.
Fragment.prototype.toJSON = function () {
  return this.content.length ? this.content.map(function (n) { return n.toJSON(); }) : null
};

// :: (Schema, ?Object) → Fragment
// Deserialize a fragment from its JSON representation.
Fragment.fromJSON = function (schema, value) {
  return value ? new Fragment(value.map(schema.nodeFromJSON)) : Fragment.empty
};

// :: ([Node]) → Fragment
// Build a fragment from an array of nodes. Ensures that adjacent
// text nodes with the same style are joined together.
Fragment.fromArray = function (array) {
  if (!array.length) { return Fragment.empty }
  var joined, size = 0
  for (var i = 0; i < array.length; i++) {
    var node = array[i]
    size += node.nodeSize
    if (i && node.isText && array[i - 1].sameMarkup(node)) {
      if (!joined) { joined = array.slice(0, i) }
      joined[joined.length - 1] = node.withText(joined[joined.length - 1].text + node.text)
    } else if (joined) {
      joined.push(node)
    }
  }
  return new Fragment(joined || array, size)
};

// :: (?union<Fragment, Node, [Node]>) → Fragment
// Create a fragment from something that can be interpreted as a set
// of nodes. For `null`, it returns the empty fragment. For a
// fragment, the fragment itself. For a node or array of nodes, a
// fragment containing those nodes.
Fragment.from = function (nodes) {
  if (!nodes) { return Fragment.empty }
  if (nodes instanceof Fragment) { return nodes }
  if (Array.isArray(nodes)) { return this.fromArray(nodes) }
  return new Fragment([nodes], nodes.nodeSize)
};

Object.defineProperties( Fragment.prototype, prototypeAccessors );
exports.Fragment = Fragment

var found = {index: 0, offset: 0}
function retIndex(index, offset) {
  found.index = index
  found.offset = offset
  return found
}

// :: Fragment
// An empty fragment. Intended to be reused whenever a node doesn't
// contain anything (rather than allocating a new empty fragment for
// each leaf node).
Fragment.empty = new Fragment([], 0)
