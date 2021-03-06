// DOMOutputSpec:: interface
// A description of a DOM structure. Can be either a string, which is
// interpreted as a text node, a DOM node, which is interpreted as
// itself, or an array.
//
// An array describes a DOM element. The first element in the array
// should be a string, and is the name of the DOM element. If the
// second element is a non-Array, non-DOM node object, it is
// interpreted as an object providing the DOM element's attributes.
// Any elements after that (including the 2nd if it's not an attribute
// object) are interpreted as children of the DOM elements, and must
// either be valid `DOMOutputSpec` values, or the number zero.
//
// The number zero (pronounced “hole”) is used to indicate the place
// where a ProseMirror node's content should be inserted.

// ::- A DOM serializer knows how to convert ProseMirror nodes and
// marks of various types to DOM nodes.
var DOMSerializer = function(nodes, marks) {
  // :: Object<(node: Node) → DOMOutputSpec>
  this.nodes = nodes || {}
  // :: Object<(mark: Mark) → DOMOutputSpec>
  this.marks = marks || {}
};

// :: (Fragment, ?Object) → dom.DocumentFragment
// Serialize the content of this fragment to a DOM fragment. When
// not in the browser, the `document` option, containing a DOM
// document, should be passed so that the serializer can create
// nodes.
DOMSerializer.prototype.serializeFragment = function (fragment, options, target) {
    var this$1 = this;
    if ( options === void 0 ) options = {};

  if (!target) { target = doc(options).createDocumentFragment() }

  var top = target, active = null
  fragment.forEach(function (node) {
    if (active || node.marks.length) {
      if (!active) { active = [] }
      var keep = 0
      for (; keep < Math.min(active.length, node.marks.length); ++keep)
        { if (!node.marks[keep].eq(active[keep])) { break } }
      while (keep < active.length) {
        active.pop()
        top = top.parentNode
      }
      while (active.length < node.marks.length) {
        var add = node.marks[active.length]
        active.push(add)
        top = top.appendChild(this$1.serializeMark(add, options))
      }
    }
    top.appendChild(this$1.serializeNode(node, options))
  })

  return target
};

// :: (Node, ?Object) → dom.Node
// Serialize this node to a DOM node. This can be useful when you
// need to serialize a part of a document, as opposed to the whole
// document. To serialize a whole document, use
// [`serializeFragment`](#model.DOMSerializer.serializeFragment) on
// its [`content`](#model.Node.content).
DOMSerializer.prototype.serializeNode = function (node, options) {
    if ( options === void 0 ) options = {};

  return this.renderStructure(this.nodes[node.type.name](node), node, options)
};

DOMSerializer.prototype.serializeNodeAndMarks = function (node, options) {
    var this$1 = this;
    if ( options === void 0 ) options = {};

  var dom = this.serializeNode(node, options)
  for (var i = node.marks.length - 1; i >= 0; i--) {
    var wrap = this$1.serializeMark(node.marks[i], options)
    wrap.appendChild(dom)
    dom = wrap
  }
  return dom
};

DOMSerializer.prototype.serializeMark = function (mark, options) {
    if ( options === void 0 ) options = {};

  return this.renderStructure(this.marks[mark.type.name](mark), null, options)
};

// :: (dom.Document, DOMOutputSpec) → {dom: dom.Node, contentDOM: ?dom.Node}
// Render an [output spec](##model.DOMOutputSpec).
DOMSerializer.renderSpec = function (doc, structure) {
  if (typeof structure == "string")
    { return {dom: doc.createTextNode(structure)} }
  if (structure.nodeType != null)
    { return {dom: structure} }
  var dom = doc.createElement(structure[0]), contentDOM = null
  var attrs = structure[1], start = 1
  if (attrs && typeof attrs == "object" && attrs.nodeType == null && !Array.isArray(attrs)) {
    start = 2
    for (var name in attrs) {
      if (name == "style") { dom.style.cssText = attrs[name] }
      else if (attrs[name] != null) { dom.setAttribute(name, attrs[name]) }
    }
  }
  for (var i = start; i < structure.length; i++) {
    var child = structure[i]
    if (child === 0) {
      if (i < structure.length - 1 || i > start)
        { throw new RangeError("Content hole must be the only child of its parent node") }
      return {dom: dom, contentDOM: dom}
    } else {
      var ref = DOMSerializer.renderSpec(doc, child);
        var inner = ref.dom;
        var innerContent = ref.contentDOM;
      dom.appendChild(inner)
      if (innerContent) {
        if (contentDOM) { throw new RangeError("Multiple content holes") }
        contentDOM = innerContent
      }
    }
  }
  return {dom: dom, contentDOM: contentDOM}
};

DOMSerializer.prototype.renderStructure = function (structure, node, options) {
  var ref = DOMSerializer.renderSpec(doc(options), structure);
    var dom = ref.dom;
    var contentDOM = ref.contentDOM;
  if (node && !node.isLeaf) {
    if (!contentDOM) { throw new RangeError("No content hole in template for non-leaf node") }
    if (options.onContent)
      { options.onContent(node, contentDOM, options) }
    else
      { this.serializeFragment(node.content, options, contentDOM) }
  } else if (contentDOM) {
    throw new RangeError("Content hole not allowed in a mark or leaf node spec")
  }
  return dom
};

// :: (Schema) → DOMSerializer
// Build a serializer using the [`toDOM`](#model.NodeSpec.toDOM)
// properties in a schema's node and mark specs.
DOMSerializer.fromSchema = function (schema) {
  return schema.cached.domSerializer ||
    (schema.cached.domSerializer = new DOMSerializer(this.nodesFromSchema(schema), this.marksFromSchema(schema)))
};

// :: (Schema) → Object<(node: Node) → DOMOutputSpec>
// Gather the serializers in a schema's node specs into an object.
// This can be useful as a base to build a custom serializer from.
DOMSerializer.nodesFromSchema = function (schema) {
  var result = gatherToDOM(schema.nodes)
  if (!result.text) { result.text = function (node) { return node.text; } }
  return result
};

// :: (Schema) → Object<(mark: Mark) → DOMOutputSpec>
// Gather the serializers in a schema's mark specs into an object.
DOMSerializer.marksFromSchema = function (schema) {
  return gatherToDOM(schema.marks)
};
exports.DOMSerializer = DOMSerializer

function gatherToDOM(obj) {
  var result = {}
  for (var name in obj) {
    var toDOM = obj[name].spec.toDOM
    if (toDOM) { result[name] = toDOM }
  }
  return result
}

function doc(options) {
  // declare global: window
  return options.document || window.document
}
