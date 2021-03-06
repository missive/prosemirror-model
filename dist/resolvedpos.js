var ref = require("./mark");
var Mark = ref.Mark;

// ::- You'll often have to '[resolve](#model.Node.resolve)' a
// position to get the context you need. Objects of this class
// represent such a resolved position, providing various pieces of
// context information and helper methods.
//
// Throughout this interface, methods that take an optional `depth`
// parameter will interpret undefined as `this.depth` and negative
// numbers as `this.depth + value`.
var ResolvedPos = function(pos, path, parentOffset) {
  // :: number The position that was resolved.
  this.pos = pos
  this.path = path
  // :: number
  // The number of levels the parent node is from the root. If this
  // position points directly into the root, it is 0. If it points
  // into a top-level paragraph, 1, and so on.
  this.depth = path.length / 3 - 1
  // :: number The offset this position has into its parent node.
  this.parentOffset = parentOffset
};

var prototypeAccessors = { parent: {},textOffset: {},nodeAfter: {},nodeBefore: {} };

ResolvedPos.prototype.resolveDepth = function (val) {
  if (val == null) { return this.depth }
  if (val < 0) { return this.depth + val }
  return val
};

// :: Node
// The parent node that the position points into. Note that even if
// a position points into a text node, that node is not considered
// the parent—text nodes are 'flat' in this model.
prototypeAccessors.parent.get = function () { return this.node(this.depth) };

// :: (?number) → Node
// The ancestor node at the given level. `p.node(p.depth)` is the
// same as `p.parent`.
ResolvedPos.prototype.node = function (depth) { return this.path[this.resolveDepth(depth) * 3] };

// :: (?number) → number
// The index into the ancestor at the given level. If this points at
// the 3rd node in the 2nd paragraph on the top level, for example,
// `p.index(0)` is 2 and `p.index(1)` is 3.
ResolvedPos.prototype.index = function (depth) { return this.path[this.resolveDepth(depth) * 3 + 1] };

// :: (?number) → number
// The index pointing after this position into the ancestor at the
// given level.
ResolvedPos.prototype.indexAfter = function (depth) {
  depth = this.resolveDepth(depth)
  return this.index(depth) + (depth == this.depth && !this.textOffset ? 0 : 1)
};

// :: (?number) → number
// The (absolute) position at the start of the node at the given
// level.
ResolvedPos.prototype.start = function (depth) {
  depth = this.resolveDepth(depth)
  return depth == 0 ? 0 : this.path[depth * 3 - 1] + 1
};

// :: (?number) → number
// The (absolute) position at the end of the node at the given
// level.
ResolvedPos.prototype.end = function (depth) {
  depth = this.resolveDepth(depth)
  return this.start(depth) + this.node(depth).content.size
};

// :: (?number) → number
// The (absolute) position directly before the node at the given
// level, or, when `level` is `this.level + 1`, the original
// position.
ResolvedPos.prototype.before = function (depth) {
  depth = this.resolveDepth(depth)
  if (!depth) { throw new RangeError("There is no position before the top-level node") }
  return depth == this.depth + 1 ? this.pos : this.path[depth * 3 - 1]
};

// :: (?number) → number
// The (absolute) position directly after the node at the given
// level, or, when `level` is `this.level + 1`, the original
// position.
ResolvedPos.prototype.after = function (depth) {
  depth = this.resolveDepth(depth)
  if (!depth) { throw new RangeError("There is no position after the top-level node") }
  return depth == this.depth + 1 ? this.pos : this.path[depth * 3 - 1] + this.path[depth * 3].nodeSize
};

// :: number
// When this position points into a text node, this returns the
// distance between the position and the start of the text node.
// Will be zero for positions that point between nodes.
prototypeAccessors.textOffset.get = function () { return this.pos - this.path[this.path.length - 1] };

// :: ?Node
// Get the node directly after the position, if any. If the position
// points into a text node, only the part of that node after the
// position is returned.
prototypeAccessors.nodeAfter.get = function () {
  var parent = this.parent, index = this.index(this.depth)
  if (index == parent.childCount) { return null }
  var dOff = this.pos - this.path[this.path.length - 1], child = parent.child(index)
  return dOff ? parent.child(index).cut(dOff) : child
};

// :: ?Node
// Get the node directly before the position, if any. If the
// position points into a text node, only the part of that node
// before the position is returned.
prototypeAccessors.nodeBefore.get = function () {
  var index = this.index(this.depth)
  var dOff = this.pos - this.path[this.path.length - 1]
  if (dOff) { return this.parent.child(index).cut(0, dOff) }
  return index == 0 ? null : this.parent.child(index - 1)
};

// :: (?bool) → [Mark]
// Get the marks at this position, factoring in the surrounding
// marks' [`inclusive`](##model.MarkSpec.inclusive) property. If the
// position is at the start of a non-empty node, or `after` is true,
// the marks of the node after it (if any) are returned.
ResolvedPos.prototype.marks = function (after) {
  var parent = this.parent, index = this.index()

  // In an empty parent, return the empty array
  if (parent.content.size == 0) { return Mark.none }

  // When inside a text node, just return the text node's marks
  if (this.textOffset) { return parent.child(index).marks }

  var main = parent.maybeChild(index - 1), other = parent.maybeChild(index)
  // If the `after` flag is true of there is no node before, make
  // the node after this position the main reference.
  if ((after && other) || !main) { var tmp = main; main = other; other = tmp }

  // Use all marks in the main node, except those that have
  // `inclusive` set to false and are not present in the other node.
  var marks = main.marks
  for (var i = 0; i < marks.length; i++)
    { if (marks[i].type.spec.inclusive === false && (!other || !marks[i].isInSet(other.marks)))
      { marks = marks[i--].removeFromSet(marks) } }

  return marks
};

// :: (number) → number
// The depth up to which this position and the given (non-resolved)
// position share the same parent nodes.
ResolvedPos.prototype.sharedDepth = function (pos) {
    var this$1 = this;

  for (var depth = this.depth; depth > 0; depth--)
    { if (this$1.start(depth) <= pos && this$1.end(depth) >= pos) { return depth } }
  return 0
};

// :: (?ResolvedPos, ?(Node) → bool) → ?NodeRange
// Returns a range based on the place where this position and the
// given position diverge around block content. If both point into
// the same textblock, for example, a range around that textblock
// will be returned. If they point into different blocks, the range
// around those blocks or their ancestors in their common ancestor
// is returned. You can pass in an optional predicate that will be
// called with a parent node to see if a range into that parent is
// acceptable.
ResolvedPos.prototype.blockRange = function (other, pred) {
    var this$1 = this;
    if ( other === void 0 ) other = this;

  if (other.pos < this.pos) { return other.blockRange(this) }
  for (var d = this.depth - (this.parent.inlineContent || this.pos == other.pos ? 1 : 0); d >= 0; d--)
    { if (other.pos <= this$1.end(d) && (!pred || pred(this$1.node(d))))
      { return new NodeRange(this$1, other, d) } }
};

// :: (ResolvedPos) → bool
// Query whether the given position shares the same parent node.
ResolvedPos.prototype.sameParent = function (other) {
  return this.pos - this.parentOffset == other.pos - other.parentOffset
};

ResolvedPos.prototype.toString = function () {
    var this$1 = this;

  var str = ""
  for (var i = 1; i <= this.depth; i++)
    { str += (str ? "/" : "") + this$1.node(i).type.name + "_" + this$1.index(i - 1) }
  return str + ":" + this.parentOffset
};

ResolvedPos.resolve = function (doc, pos) {
  if (!(pos >= 0 && pos <= doc.content.size)) { throw new RangeError("Position " + pos + " out of range") }
  var path = []
  var start = 0, parentOffset = pos
  for (var node = doc;;) {
    var ref = node.content.findIndex(parentOffset);
      var index = ref.index;
      var offset = ref.offset;
    var rem = parentOffset - offset
    path.push(node, index, start + offset)
    if (!rem) { break }
    node = node.child(index)
    if (node.isText) { break }
    parentOffset = rem - 1
    start += offset + 1
  }
  return new ResolvedPos(pos, path, parentOffset)
};

ResolvedPos.resolveCached = function (doc, pos) {
  for (var i = 0; i < resolveCache.length; i++) {
    var cached = resolveCache[i]
    if (cached.pos == pos && cached.node(0) == doc) { return cached }
  }
  var result = resolveCache[resolveCachePos] = ResolvedPos.resolve(doc, pos)
  resolveCachePos = (resolveCachePos + 1) % resolveCacheSize
  return result
};

Object.defineProperties( ResolvedPos.prototype, prototypeAccessors );
exports.ResolvedPos = ResolvedPos

var resolveCache = [], resolveCachePos = 0, resolveCacheSize = 6

// ::- Represents a flat range of content.
var NodeRange = function($from, $to, depth) {
  // :: ResolvedPos A resolved position along the start of the
  // content. May have a `depth` greater than this object's `depth`
  // property, since these are the positions that were used to
  // compute the range, not re-resolved positions directly at its
  // boundaries.
  this.$from = $from
  // :: ResolvedPos A position along the end of the content. See
  // caveat for [`$from`](#model.NodeRange.$from).
  this.$to = $to
  // :: number The depth of the node that this range points into.
  this.depth = depth
};

var prototypeAccessors$1 = { start: {},end: {},parent: {},startIndex: {},endIndex: {} };

// :: number The position at the start of the range.
prototypeAccessors$1.start.get = function () { return this.$from.before(this.depth + 1) };
// :: number The position at the end of the range.
prototypeAccessors$1.end.get = function () { return this.$to.after(this.depth + 1) };

// :: Node The parent node that the range points into.
prototypeAccessors$1.parent.get = function () { return this.$from.node(this.depth) };
// :: number The start index of the range in the parent node.
prototypeAccessors$1.startIndex.get = function () { return this.$from.index(this.depth) };
// :: number The end index of the range in the parent node.
prototypeAccessors$1.endIndex.get = function () { return this.$to.indexAfter(this.depth) };

Object.defineProperties( NodeRange.prototype, prototypeAccessors$1 );
exports.NodeRange = NodeRange
