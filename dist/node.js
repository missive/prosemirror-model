var ref = require("./fragment");
var Fragment = ref.Fragment;
var ref$1 = require("./mark");
var Mark = ref$1.Mark;
var ref$2 = require("./replace");
var Slice = ref$2.Slice;
var replace = ref$2.replace;
var ref$3 = require("./resolvedpos");
var ResolvedPos = ref$3.ResolvedPos;
var ref$4 = require("./comparedeep");
var compareDeep = ref$4.compareDeep;

var emptyAttrs = Object.create(null)

// ::- This class represents a node in the tree that makes up a
// ProseMirror document. So a document is an instance of `Node`, with
// children that are also instances of `Node`.
//
// Nodes are persistent data structures. Instead of changing them, you
// create new ones with the content you want. Old ones keep pointing
// at the old document shape. This is made cheaper by sharing
// structure between the old and new data as much as possible, which a
// tree shape like this (without back pointers) makes easy.
//
// **Never** directly mutate the properties of a `Node` object. See
// [this guide](/docs/guides/doc/) for more information.
var Node = function(type, attrs, content, marks) {
  // :: NodeType
  // The type of node that this is.
  this.type = type

  // :: Object
  // An object mapping attribute names to values. The kind of
  // attributes allowed and required are determined by the node
  // type.
  this.attrs = attrs

  // :: Fragment
  // A container holding the node's children.
  this.content = content || Fragment.empty

  // :: [Mark]
  // The marks (things like whether it is emphasized or part of a
  // link) associated with this node.
  this.marks = marks || Mark.none
};

var prototypeAccessors = { nodeSize: {},childCount: {},textContent: {},firstChild: {},lastChild: {},isBlock: {},isTextblock: {},inlineContent: {},isInline: {},isText: {},isLeaf: {},isAtom: {} };

// text:: ?string
// For text nodes, this contains the node's text content.

// :: number
// The size of this node, as defined by the integer-based [indexing
// scheme](/docs/guides/doc/#indexing). For text nodes, this is the
// amount of characters. For other leaf nodes, it is one. And for
// non-leaf nodes, it is the size of the content plus two (the start
// and end token).
prototypeAccessors.nodeSize.get = function () { return this.isLeaf ? 1 : 2 + this.content.size };

// :: number
// The number of children that the node has.
prototypeAccessors.childCount.get = function () { return this.content.childCount };

// :: (number) → Node
// Get the child node at the given index. Raises an error when the
// index is out of range.
Node.prototype.child = function (index) { return this.content.child(index) };

// :: (number) → ?Node
// Get the child node at the given index, if it exists.
Node.prototype.maybeChild = function (index) { return this.content.maybeChild(index) };

// :: ((node: Node, offset: number, index: number))
// Call `f` for every child node, passing the node, its offset
// into this parent node, and its index.
Node.prototype.forEach = function (f) { this.content.forEach(f) };

// :: (?number, ?number, (node: Node, pos: number, parent: Node, index: number))
// Invoke a callback for all descendant nodes recursively between
// the given two positions that are relative to start of this node's content.
// The callback is invoked with the node, its parent-relative position,
// its parent node, and its child index. If the callback returns false,
// the current node's children will not be recursed over.
Node.prototype.nodesBetween = function (from, to, f, pos) {
    if ( pos === void 0 ) pos = 0;

  this.content.nodesBetween(from, to, f, pos, this)
};

// :: ((node: Node, pos: number, parent: Node))
// Call the given callback for every descendant node.
Node.prototype.descendants = function (f) {
  this.nodesBetween(0, this.content.size, f)
};

// :: string
// Concatenates all the text nodes found in this fragment and its
// children.
prototypeAccessors.textContent.get = function () { return this.textBetween(0, this.content.size, "") };

// :: (number, number, ?string, ?string) → string
// Get all text between positions `from` and `to`. When
// `blockSeparator` is given, it will be inserted whenever a new
// block node is started. When `leafText` is given, it'll be
// inserted for every non-text leaf node encountered.
Node.prototype.textBetween = function (from, to, blockSeparator, leafText) {
  return this.content.textBetween(from, to, blockSeparator, leafText)
};

// :: ?Node
// Returns this node's first child, or `null` if there are no
// children.
prototypeAccessors.firstChild.get = function () { return this.content.firstChild };

// :: ?Node
// Returns this node's last child, or `null` if there are no
// children.
prototypeAccessors.lastChild.get = function () { return this.content.lastChild };

// :: (Node) → bool
// Test whether two nodes represent the same content.
Node.prototype.eq = function (other) {
  return this == other || (this.sameMarkup(other) && this.content.eq(other.content))
};

// :: (Node) → bool
// Compare the markup (type, attributes, and marks) of this node to
// those of another. Returns `true` if both have the same markup.
Node.prototype.sameMarkup = function (other) {
  return this.hasMarkup(other.type, other.attrs, other.marks)
};

// :: (NodeType, ?Object, ?[Mark]) → bool
// Check whether this node's markup correspond to the given type,
// attributes, and marks.
Node.prototype.hasMarkup = function (type, attrs, marks) {
  return this.type == type &&
    compareDeep(this.attrs, attrs || type.defaultAttrs || emptyAttrs) &&
    Mark.sameSet(this.marks, marks || Mark.none)
};

// :: (?Fragment) → Node
// Create a new node with the same markup as this node, containing
// the given content (or empty, if no content is given).
Node.prototype.copy = function (content) {
    if ( content === void 0 ) content = null;

  if (content == this.content) { return this }
  return new this.constructor(this.type, this.attrs, content, this.marks)
};

// :: ([Mark]) → Node
// Create a copy of this node, with the given set of marks instead
// of the node's own marks.
Node.prototype.mark = function (marks) {
  return marks == this.marks ? this : new this.constructor(this.type, this.attrs, this.content, marks)
};

// :: (number, ?number) → Node
// Create a copy of this node with only the content between the
// given offsets. If `to` is not given, it defaults to the end of
// the node.
Node.prototype.cut = function (from, to) {
  if (from == 0 && to == this.content.size) { return this }
  return this.copy(this.content.cut(from, to))
};

// :: (number, ?number) → Slice
// Cut out the part of the document between the given positions, and
// return it as a `Slice` object.
Node.prototype.slice = function (from, to, includeParents) {
    if ( to === void 0 ) to = this.content.size;
    if ( includeParents === void 0 ) includeParents = false;

  if (from == to) { return Slice.empty }

  var $from = this.resolve(from), $to = this.resolve(to)
  var depth = includeParents ? 0 : $from.sharedDepth(to)
  var start = $from.start(depth), node = $from.node(depth)
  var content = node.content.cut($from.pos - start, $to.pos - start)
  return new Slice(content, $from.depth - depth, $to.depth - depth)
};

// :: (number, number, Slice) → Node
// Replace the part of the document between the given positions with
// the given slice. The slice must 'fit', meaning its open sides
// must be able to connect to the surrounding content, and its
// content nodes must be valid children for the node they are placed
// into. If any of this is violated, an error of type
// [`ReplaceError`](#model.ReplaceError) is thrown.
Node.prototype.replace = function (from, to, slice) {
  return replace(this.resolve(from), this.resolve(to), slice)
};

// :: (number) → ?Node
// Find the node after the given position.
Node.prototype.nodeAt = function (pos) {
  for (var node = this;;) {
    var ref = node.content.findIndex(pos);
      var index = ref.index;
      var offset = ref.offset;
    node = node.maybeChild(index)
    if (!node) { return null }
    if (offset == pos || node.isText) { return node }
    pos -= offset + 1
  }
};

// :: (number) → {node: ?Node, index: number, offset: number}
// Find the (direct) child node after the given offset, if any,
// and return it along with its index and offset relative to this
// node.
Node.prototype.childAfter = function (pos) {
  var ref = this.content.findIndex(pos);
    var index = ref.index;
    var offset = ref.offset;
  return {node: this.content.maybeChild(index), index: index, offset: offset}
};

// :: (number) → {node: ?Node, index: number, offset: number}
// Find the (direct) child node before the given offset, if any,
// and return it along with its index and offset relative to this
// node.
Node.prototype.childBefore = function (pos) {
  if (pos == 0) { return {node: null, index: 0, offset: 0} }
  var ref = this.content.findIndex(pos);
    var index = ref.index;
    var offset = ref.offset;
  if (offset < pos) { return {node: this.content.child(index), index: index, offset: offset} }
  var node = this.content.child(index - 1)
  return {node: node, index: index - 1, offset: offset - node.nodeSize}
};

// :: (number) → ResolvedPos
// Resolve the given position in the document, returning an object
// describing its path through the document.
Node.prototype.resolve = function (pos) { return ResolvedPos.resolveCached(this, pos) };

Node.prototype.resolveNoCache = function (pos) { return ResolvedPos.resolve(this, pos) };

// :: (?number, ?number, MarkType) → bool
// Test whether a mark of the given type occurs in this document
// between the two given positions.
Node.prototype.rangeHasMark = function (from, to, type) {
  var found = false
  this.nodesBetween(from, to, function (node) {
    if (type.isInSet(node.marks)) { found = true }
    return !found
  })
  return found
};

// :: bool
// True when this is a block (non-inline node)
prototypeAccessors.isBlock.get = function () { return this.type.isBlock };

// :: bool
// True when this is a textblock node, a block node with inline
// content.
prototypeAccessors.isTextblock.get = function () { return this.type.isTextblock };

// :: bool
// True when this node has inline content.
prototypeAccessors.inlineContent.get = function () { return this.type.inlineContent };

// :: bool
// True when this is an inline node (a text node or a node that can
// appear among text).
prototypeAccessors.isInline.get = function () { return this.type.isInline };

// :: bool
// True when this is a text node.
prototypeAccessors.isText.get = function () { return this.type.isText };

// :: bool
// True when this is a leaf node.
prototypeAccessors.isLeaf.get = function () { return this.type.isLeaf };

// :: bool
// True when this is an atom, i.e. when it does not have directly
// editable content. This is usually the same as `isLeaf`, but can
// be configured with the [`leaf` property](#model.NodeSpec.leaf) on
// a node's spec (typically when the node is displayed as an
// uneditable [node view](#view.NodeView)).
prototypeAccessors.isAtom.get = function () { return this.type.isAtom };

// :: () → string
// Return a string representation of this node for debugging
// purposes.
Node.prototype.toString = function () {
  var name = this.type.name
  if (this.content.size)
    { name += "(" + this.content.toStringInner() + ")" }
  return wrapMarks(this.marks, name)
};

// :: (number) → ContentMatch
// Get the content match in this node at the given index.
Node.prototype.contentMatchAt = function (index) {
  return this.type.contentExpr.getMatchAt(this.attrs, this.content, index)
};

// :: (number, number, ?Fragment, ?number, ?number) → bool
// Test whether replacing the range `from` to `to` (by index) with
// the given replacement fragment (which defaults to the empty
// fragment) would leave the node's content valid. You can
// optionally pass `start` and `end` indices into the replacement
// fragment.
Node.prototype.canReplace = function (from, to, replacement, start, end) {
  return this.type.contentExpr.checkReplace(this.attrs, this.content, from, to, replacement, start, end)
};

// :: (number, number, NodeType, ?[Mark]) → bool
// Test whether replacing the range `from` to `to` (by index) with a
// node of the given type with the given attributes and marks would
// be valid.
Node.prototype.canReplaceWith = function (from, to, type, attrs, marks) {
  return this.type.contentExpr.checkReplaceWith(this.attrs, this.content, from, to, type, attrs, marks || Mark.none)
};

// :: (Node) → bool
// Test whether the given node's content could be appended to this
// node. If that node is empty, this will only return true if there
// is at least one node type that can appear in both nodes (to avoid
// merging completely incompatible nodes).
Node.prototype.canAppend = function (other) {
  if (other.content.size) { return this.canReplace(this.childCount, this.childCount, other.content) }
  else { return this.type.compatibleContent(other.type) }
};

Node.prototype.defaultContentType = function (at) {
  var elt = this.contentMatchAt(at).nextElement
  return elt && elt.defaultType()
};

// :: ()
// Check whether this node and its descendants conform to the
// schema, and raise error when they do not.
Node.prototype.check = function () {
  if (!this.type.validContent(this.content, this.attrs))
    { throw new RangeError(("Invalid content for node " + (this.type.name) + ": " + (this.content.toString().slice(0, 50)))) }
  this.content.forEach(function (node) { return node.check(); })
};

// :: () → Object
// Return a JSON-serializeable representation of this node.
Node.prototype.toJSON = function () {
    var this$1 = this;

  var obj = {type: this.type.name}
  for (var _ in this$1.attrs) {
    obj.attrs = this$1.attrs
    break
  }
  if (this.content.size)
    { obj.content = this.content.toJSON() }
  if (this.marks.length)
    { obj.marks = this.marks.map(function (n) { return n.toJSON(); }) }
  return obj
};

// :: (Schema, Object) → Node
// Deserialize a node from its JSON representation.
Node.fromJSON = function (schema, json) {
  var marks = json.marks && json.marks.map(schema.markFromJSON)
  if (json.type == "text") { return schema.text(json.text, marks) }
  var type = schema.nodeType(json.type)
  if (!type) { throw new RangeError(("There is no node type " + (json.type) + " in this schema")) }
  return type.create(json.attrs, Fragment.fromJSON(schema, json.content), marks)
};

Object.defineProperties( Node.prototype, prototypeAccessors );
exports.Node = Node

var TextNode = (function (Node) {
  function TextNode(type, attrs, content, marks) {
    Node.call(this, type, attrs, null, marks)

    if (!content) { throw new RangeError("Empty text nodes are not allowed") }

    this.text = content
  }

  if ( Node ) TextNode.__proto__ = Node;
  TextNode.prototype = Object.create( Node && Node.prototype );
  TextNode.prototype.constructor = TextNode;

  var prototypeAccessors$1 = { textContent: {},nodeSize: {} };

  TextNode.prototype.toString = function () { return wrapMarks(this.marks, JSON.stringify(this.text)) };

  prototypeAccessors$1.textContent.get = function () { return this.text };

  TextNode.prototype.textBetween = function (from, to) { return this.text.slice(from, to) };

  prototypeAccessors$1.nodeSize.get = function () { return this.text.length };

  TextNode.prototype.mark = function (marks) {
    return new TextNode(this.type, this.attrs, this.text, marks)
  };

  TextNode.prototype.withText = function (text) {
    if (text == this.text) { return this }
    return new TextNode(this.type, this.attrs, text, this.marks)
  };

  TextNode.prototype.cut = function (from, to) {
    if ( from === void 0 ) from = 0;
    if ( to === void 0 ) to = this.text.length;

    if (from == 0 && to == this.text.length) { return this }
    return this.withText(this.text.slice(from, to))
  };

  TextNode.prototype.eq = function (other) {
    return this.sameMarkup(other) && this.text == other.text
  };

  TextNode.prototype.toJSON = function () {
    var base = Node.prototype.toJSON.call(this)
    base.text = this.text
    return base
  };

  Object.defineProperties( TextNode.prototype, prototypeAccessors$1 );

  return TextNode;
}(Node));
exports.TextNode = TextNode

function wrapMarks(marks, str) {
  for (var i = marks.length - 1; i >= 0; i--)
    { str = marks[i].type.name + "(" + str + ")" }
  return str
}
