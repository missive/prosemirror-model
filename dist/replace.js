var ref = require("./fragment");
var Fragment = ref.Fragment;

// ::- Error type raised by [`Node.replace`](#model.Node.replace) when
// given an invalid replacement.
var ReplaceError = (function (Error) {
  function ReplaceError(message) {
    Error.call(this, message)
    this.message = message
  }

  if ( Error ) ReplaceError.__proto__ = Error;
  ReplaceError.prototype = Object.create( Error && Error.prototype );
  ReplaceError.prototype.constructor = ReplaceError;

  var prototypeAccessors = { name: {} };
  prototypeAccessors.name.get = function () { return "ReplaceError" };

  Object.defineProperties( ReplaceError.prototype, prototypeAccessors );

  return ReplaceError;
}(Error));
exports.ReplaceError = ReplaceError

// ::- A slice represents a piece cut out of a larger document. It
// stores not only a fragment, but also the depth up to which nodes on
// both side are 'open' / cut through.
var Slice = function(content, openLeft, openRight) {
  // :: Fragment The slice's content nodes.
  this.content = content
  // :: number The open depth at the start.
  this.openLeft = openLeft
  // :: number The open depth at the end.
  this.openRight = openRight
};

var prototypeAccessors$1 = { size: {} };

// :: number
// The size this slice would add when inserted into a document.
prototypeAccessors$1.size.get = function () {
  return this.content.size - this.openLeft - this.openRight
};

Slice.prototype.insertAt = function (pos, fragment) {
  var content = insertInto(this.content, pos + this.openLeft, fragment, null)
  return content && new Slice(content, this.openLeft, this.openRight)
};

Slice.prototype.removeBetween = function (from, to) {
  return new Slice(removeRange(this.content, from + this.openLeft, to + this.openLeft), this.openLeft, this.openRight)
};

Slice.prototype.eq = function (other) {
  return this.content.eq(other.content) && this.openLeft == other.openLeft && this.openRight == other.openRight
};

Slice.prototype.toString = function () {
  return this.content + "(" + this.openLeft + "," + this.openRight + ")"
};

// :: () → ?Object
// Convert a slice to a JSON-serializable representation.
Slice.prototype.toJSON = function () {
  if (!this.content.size) { return null }
  return {content: this.content.toJSON(),
          openLeft: this.openLeft,
          openRight: this.openRight}
};

// :: (Schema, ?Object) → Slice
// Deserialize a slice from its JSON representation.
Slice.fromJSON = function (schema, json) {
  if (!json) { return Slice.empty }
  return new Slice(Fragment.fromJSON(schema, json.content), json.openLeft, json.openRight)
};

// :: (Fragment) → Slice
// Create a slice from a fragment by taking the maximum possible
// open value on both side of the fragment.
Slice.maxOpen = function (fragment) {
  var openLeft = 0, openRight = 0
  for (var n = fragment.firstChild; n && !n.isLeaf; n = n.firstChild) { openLeft++ }
  for (var n$1 = fragment.lastChild; n$1 && !n$1.isLeaf; n$1 = n$1.lastChild) { openRight++ }
  return new Slice(fragment, openLeft, openRight)
};

Object.defineProperties( Slice.prototype, prototypeAccessors$1 );
exports.Slice = Slice

function removeRange(content, from, to) {
  var ref = content.findIndex(from);
  var index = ref.index;
  var offset = ref.offset;
  var child = content.maybeChild(index)
  var ref$1 = content.findIndex(to);
  var indexTo = ref$1.index;
  var offsetTo = ref$1.offset;
  if (offset == from || child.isText) {
    if (offsetTo != to && !content.child(indexTo).isText) { throw new RangeError("Removing non-flat range") }
    return content.cut(0, from).append(content.cut(to))
  }
  if (index != indexTo) { throw new RangeError("Removing non-flat range") }
  return content.replaceChild(index, child.copy(removeRange(child.content, from - offset - 1, to - offset - 1)))
}

function insertInto(content, dist, insert, parent) {
  var ref = content.findIndex(dist);
  var index = ref.index;
  var offset = ref.offset;
  var child = content.maybeChild(index)
  if (offset == dist || child.isText) {
    if (parent && !parent.canReplace(index, index, insert)) { return null }
    return content.cut(0, dist).append(insert).append(content.cut(dist))
  }
  var inner = insertInto(child.content, dist - offset - 1, insert)
  return inner && content.replaceChild(index, child.copy(inner))
}

// :: Slice
// The empty slice.
Slice.empty = new Slice(Fragment.empty, 0, 0)

function replace($from, $to, slice) {
  if (slice.openLeft > $from.depth)
    { throw new ReplaceError("Inserted content deeper than insertion position") }
  if ($from.depth - slice.openLeft != $to.depth - slice.openRight)
    { throw new ReplaceError("Inconsistent open depths") }
  return replaceOuter($from, $to, slice, 0)
}
exports.replace = replace

function replaceOuter($from, $to, slice, depth) {
  var index = $from.index(depth), node = $from.node(depth)
  if (index == $to.index(depth) && depth < $from.depth - slice.openLeft) {
    var inner = replaceOuter($from, $to, slice, depth + 1)
    return node.copy(node.content.replaceChild(index, inner))
  } else if (!slice.content.size) {
    return close(node, replaceTwoWay($from, $to, depth))
  } else if (!slice.openLeft && !slice.openRight && $from.depth == depth && $to.depth == depth) { // Simple, flat case
    var parent = $from.parent, content = parent.content
    return close(parent, content.cut(0, $from.parentOffset).append(slice.content).append(content.cut($to.parentOffset)))
  } else {
    var ref = prepareSliceForReplace(slice, $from);
    var start = ref.start;
    var end = ref.end;
    return close(node, replaceThreeWay($from, start, end, $to, depth))
  }
}

function checkJoin(main, sub) {
  if (!sub.type.compatibleContent(main.type))
    { throw new ReplaceError("Cannot join " + sub.type.name + " onto " + main.type.name) }
}

function joinable($before, $after, depth) {
  var node = $before.node(depth)
  checkJoin(node, $after.node(depth))
  return node
}

function addNode(child, target) {
  var last = target.length - 1
  if (last >= 0 && child.isText && child.sameMarkup(target[last]))
    { target[last] = child.withText(target[last].text + child.text) }
  else
    { target.push(child) }
}

function addRange($start, $end, depth, target) {
  var node = ($end || $start).node(depth)
  var startIndex = 0, endIndex = $end ? $end.index(depth) : node.childCount
  if ($start) {
    startIndex = $start.index(depth)
    if ($start.depth > depth) {
      startIndex++
    } else if ($start.textOffset) {
      addNode($start.nodeAfter, target)
      startIndex++
    }
  }
  for (var i = startIndex; i < endIndex; i++) { addNode(node.child(i), target) }
  if ($end && $end.depth == depth && $end.textOffset)
    { addNode($end.nodeBefore, target) }
}

function close(node, content) {
  if (!node.type.validContent(content, node.attrs))
    { throw new ReplaceError("Invalid content for node " + node.type.name) }
  return node.copy(content)
}

function replaceThreeWay($from, $start, $end, $to, depth) {
  var openLeft = $from.depth > depth && joinable($from, $start, depth + 1)
  var openRight = $to.depth > depth && joinable($end, $to, depth + 1)

  var content = []
  addRange(null, $from, depth, content)
  if (openLeft && openRight && $start.index(depth) == $end.index(depth)) {
    checkJoin(openLeft, openRight)
    addNode(close(openLeft, replaceThreeWay($from, $start, $end, $to, depth + 1)), content)
  } else {
    if (openLeft)
      { addNode(close(openLeft, replaceTwoWay($from, $start, depth + 1)), content) }
    addRange($start, $end, depth, content)
    if (openRight)
      { addNode(close(openRight, replaceTwoWay($end, $to, depth + 1)), content) }
  }
  addRange($to, null, depth, content)
  return new Fragment(content)
}

function replaceTwoWay($from, $to, depth) {
  var content = []
  addRange(null, $from, depth, content)
  if ($from.depth > depth) {
    var type = joinable($from, $to, depth + 1)
    addNode(close(type, replaceTwoWay($from, $to, depth + 1)), content)
  }
  addRange($to, null, depth, content)
  return new Fragment(content)
}

function prepareSliceForReplace(slice, $along) {
  var extra = $along.depth - slice.openLeft, parent = $along.node(extra)
  var node = parent.copy(slice.content)
  for (var i = extra - 1; i >= 0; i--)
    { node = $along.node(i).copy(Fragment.from(node)) }
  return {start: node.resolveNoCache(slice.openLeft + extra),
          end: node.resolveNoCache(node.content.size - slice.openRight - extra)}
}
