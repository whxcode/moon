/**
 * Moon v1.0.0-beta.2
 * Copyright 2016-2019 Kabir Shah
 * Released under the MIT License
 * https://kbrsh.github.io/moon
 */
(function(root, factory) {
	if (typeof module === "undefined") {
		root.Moon = factory();
	} else {
		module.exports = factory();
	}
}(this, function() {
	"use strict";

	/**
	 * View node types.
	 */
	var types = {
		element: 0,
		text: 1,
		component: 2
	};
	/**
	 * Checks if a given character is a quote.
	 *
	 * @param {string} char
	 * @returns {boolean} True if the character is a quote
	 */

	function isQuote(_char) {
		return _char === "\"" || _char === "'";
	}
	/**
	 * Logs an error message to the console.
	 * @param {string} message
	 */

	function error(message) {
		console.error("[Moon] ERROR: " + message);
	}
	/**
	 * Returns a value or a default fallback if the value is undefined.
	 *
	 * @param value
	 * @param fallback
	 * @returns Value or default fallback
	 */

	function defaultValue(value, fallback) {
		return value === undefined ? fallback : value;
	}
	/**
	 * Returns an object using default fallback key/value pairs if they are
	 * undefined.
	 *
	 * @param {Object} obj
	 * @param {Object} fallback
	 * @returns {Object} Full object with default key/value pairs
	 */

	function defaultObject(obj, fallback) {
		var full = {};

		for (var key in fallback) {
			full[key] = fallback[key];
		}

		for (var _key in obj) {
			full[_key] = obj[_key];
		}

		return full;
	}

	/**
	 * Capture the tag name, attribute text, and closing slash from an opening tag.
	 */

	var typeRE = /<([\w\d-_]+)([^>]*?)(\/?)>/g;
	/**
	 * Capture a key, value, and expression from a list of whitespace-separated
	 * attributes. There cannot be a value and an expression, but both are captured
	 * due to the limits of regular expressions. One or both of them can be
	 * undefined.
	 */

	var attributeRE = /\s*([\w\d-_:@]*)(?:=(?:("[^"]*"|'[^']*')|{([^{}]*)}))?/g;
	/**
	 * Capture the variables in expressions to scope them within the data
	 * parameter. This ignores property names and deep object accesses.
	 */

	var expressionRE = /"[^"]*"|'[^']*'|\d+[a-zA-Z$_]\w*|\.[a-zA-Z$_]\w*|[a-zA-Z$_]\w*:|([a-zA-Z$_]\w*)/g;
	/**
	 * List of global variables to ignore in expression scoping
	 */

	var globals = ["NaN", "false", "in", "null", "this", "true", "typeof", "undefined", "window"];
	/**
	 * Scope an expression to use variables within the `data` object.
	 *
	 * @param {string} expression
	 */

	function scopeExpression(expression) {
		return expression.replace(expressionRE, function (match, name) {
			return name === undefined || globals.indexOf(name) !== -1 ? match : "data." + name;
		});
	}
	/**
	 * Convert a token into a string, accounting for `<text/>` components.
	 *
	 * @param {Object} token
	 * @returns {String} Token converted into a string
	 */


	function tokenString(token) {
		if (token.type === "tagOpen") {
			if (token.value === "text") {
				var content = token.attributes[""]; // If the text content is surrounded with quotes, it was normal text
				// and doesn't need the quotes. If not, it was an expression and
				// needs to be formatted with curly braces.

				if (isQuote(content[0])) {
					return content.slice(1, -1);
				} else {
					return "{" + content + "}";
				}
			} else {
				var tag = "<" + token.value;

				for (var attributeKey in token.attributes) {
					var attributeValue = token.attributes[attributeKey];
					tag += " " + attributeKey + "=" + (isQuote(attributeValue[0]) ? attributeValue : "{" + attributeValue + "}");
				}

				if (token.closed) {
					tag += "/";
				}

				return tag + ">";
			}
		} else {
			return "</" + token.value + ">";
		}
	}
	/**
	 * Logs a lexer error message to the console along with the surrounding
	 * characters.
	 *
	 * @param {string} message
	 * @param {string} input
	 * @param {number} index
	 */

	function lexError(message, input, index) {
		var lexMessage = message + "\n\n"; // Show input characters surrounding the source of the error.

		for (var i = Math.max(0, index - 16); i < Math.min(index + 16, input.length); i++) {
			lexMessage += input[i];
		}

		error(lexMessage);
	}
	/**
	 * Lexer
	 *
	 * The lexer is responsible for taking an input view template and converting it
	 * into a list of tokens. To make the parser's job easier, it does some extra
	 * processing and handles tag names, attribute key/value pairs, and converting
	 * text into `<text/>` components.
	 *
	 * It works by running through the input text and checking for specific initial
	 * characters such as "<", "{", or any text. After identifying the type of
	 * token, it processes each part individually until the end of the token. The
	 * lexer appends the new token to a cumulative list and eventually returns it.
	 *
	 * @param {string} input
	 * @returns {Object[]} List of tokens
	 */


	function lex(input) {
		// Remove leading and trailing whitespace because the lexer should only
		// accept one element as an input, and whitespace counts as text.
		input = input.trim();
		var tokens = [];

		for (var i = 0; i < input.length;) {
			var _char = input[i];

			if (_char === "<") {
				var charNext = input[i + 1];

				if ("development" === "development" && charNext === undefined) {
					lexError("Lexer expected a character after \"<\".", input, i);
					break;
				}

				if (charNext === "/") {
					// Append a closing tag token if a sequence of characters begins
					// with "</".
					var closeIndex = input.indexOf(">", i + 2);

					var _type = input.slice(i + 2, closeIndex);

					if ("development" === "development" && closeIndex === -1) {
						lexError("Lexer expected a closing \">\" after \"</\".", input, i);
						break;
					}

					tokens.push({
						type: "tagClose",
						value: _type
					});
					i = closeIndex + 1;
					continue;
				} else if (charNext === "!" && input[i + 2] === "-" && input[i + 3] === "-") {
					// Ignore input if a sequence of characters begins with "<!--".
					var _closeIndex = input.indexOf("-->", i + 4);

					if ("development" === "development" && _closeIndex === -1) {
						lexError("Lexer expected a closing \"-->\" after \"<!--\".", input, i);
						break;
					}

					i = _closeIndex + 3;
					continue;
				} // Set the last searched index of the tag type regular expression to
				// the index of the character currently being processed. Since it is
				// being executed on the whole input, this is required for getting the
				// correct match and having better performance.


				typeRE.lastIndex = i; // Execute the tag type regular expression on the input and store
				// the match and captured groups.

				var typeExec = typeRE.exec(input);

				if ("development" === "development" && typeExec === null) {
					lexError("Lexer expected a valid opening or self-closing tag.", input, i);
				}

				var typeMatch = typeExec[0];
				var type = typeExec[1];
				var attributesText = typeExec[2];
				var closeSlash = typeExec[3];
				var attributes = {};
				var attributeExec = void 0; // Keep matching for new attribute key/value pairs until there are no
				// more in the attribute text.

				while ((attributeExec = attributeRE.exec(attributesText)) !== null) {
					// Store the match and captured groups.
					var attributeMatch = attributeExec[0];
					var attributeKey = attributeExec[1];
					var attributeValue = attributeExec[2];
					var attributeExpression = attributeExec[3];

					if (attributeMatch.length === 0) {
						// If nothing is matched, continue searching from the next
						// character. This is required because the attribute regular
						// expression can have empty matches and create an infinite
						// loop.
						attributeRE.lastIndex += 1;
					} else {
						// Store the key/value pair using the matched value or
						// expression.
						attributes[attributeKey] = attributeExpression === undefined ? attributeValue : scopeExpression(attributeExpression);
					}
				} // Append an opening tag token with the type, attributes, and optional
				// self-closing slash.


				tokens.push({
					type: "tagOpen",
					value: type,
					attributes: attributes,
					closed: closeSlash === "/"
				});
				i += typeMatch.length;
			} else if (_char === "{") {
				// If a sequence of characters begins with "{", process it as an
				// expression token.
				var expression = ""; // Consume the input until the end of the expression.

				for (i += 1; i < input.length; i++) {
					var _char2 = input[i];

					if (_char2 === "}") {
						break;
					} else {
						expression += _char2;
					}
				} // Append the expression as a `<text/>` element with the appropriate
				// text content attribute.


				tokens.push({
					type: "tagOpen",
					value: "text",
					attributes: {
						"": scopeExpression(expression)
					},
					closed: true
				});
				i += 1;
			} else {
				// If nothing has matched at this point, process the input as text.
				var text = ""; // Consume the input until the start of a new tag or expression.

				for (; i < input.length; i++) {
					var _char3 = input[i];

					if (_char3 === "<" || _char3 === "{") {
						break;
					} else {
						text += _char3;
					}
				} // Append the text as a `<text/>` element with the appropriate text
				// content attribute.


				tokens.push({
					type: "tagOpen",
					value: "text",
					attributes: {
						"": "\"" + text + "\""
					},
					closed: true
				});
			}
		}

		return tokens;
	}

	/**
	 * Stores an error message, a slice of tokens associated with the error, and a
	 * related error for later reporting.
	 */

	function ParseError(message, start, end, next) {
		this.message = message;
		this.start = start;
		this.end = end;
		this.next = next;
	}
	/**
	 * Returns a full parse error message only if Moon is in development mode.
	 *
	 * @param {string} message
	 * @returns {string} Conditional error message
	 */


	function parseErrorMessage(message) {
		/* istanbul ignore next */
		return "development" === "development" ? message : "";
	}
	/**
	 * Given a start index, end index, and a list of tokens, return a tree after
	 * matching against the following grammar:
	 *
	 * Elements -> Empty | Element Elements
	 *
	 * The parsing algorithm is explained in more detail in the `parse` function.
	 *
	 * @param {number} start
	 * @param {number} end
	 * @param {Object[]} tokens
	 * @returns {Object} Abstract syntax tree or ParseError
	 */


	function parseElements(start, end, tokens) {
		var length = end - start;
		var error;

		if (length === 0) {
			return [];
		} else {
			for (var elementEnd = start + 1; elementEnd <= end; elementEnd++) {
				var element = parseElement(start, elementEnd, tokens);

				if (element instanceof ParseError) {
					// Store the latest error in parsing an element. This will be the
					// error with the largest possible match if all of the input tokens
					// fail to match.
					error = element;
				} else {
					var elements = parseElements(elementEnd, end, tokens);

					if (!(elements instanceof ParseError)) {
						// Combine the first element with the rest of the elements.
						var elementsAll = [element];

						for (var i = 0; i < elements.length; i++) {
							elementsAll.push(elements[i]);
						}

						return elementsAll;
					}
				}
			}

			return new ParseError(parseErrorMessage("Parser expected valid elements but encountered an error."), start, end, error);
		}
	}
	/**
	 * Given a start index, end index, and a list of tokens, return a tree after
	 * matching against the following grammar:
	 *
	 * Element -> TagSelfClosing | TagOpen Elements TagClose
	 *
	 * The parsing algorithm is explained in more detail in the `parse` function.
	 *
	 * @param {number} start
	 * @param {number} end
	 * @param {Object[]} tokens
	 * @returns {Object} Abstract syntax tree or ParseError
	 */


	function parseElement(start, end, tokens) {
		var tokenFirst = tokens[start];
		var tokenLast = tokens[end - 1];
		var length = end - start;

		if (length === 0) {
			// Return an error because this parser does not accept empty inputs.
			return new ParseError(parseErrorMessage("Parser expected an element but received nothing."), start, end);
		} else if (length === 1) {
			// The next alternate only matches on inputs with one token.
			if (tokenFirst.type === "tagOpen" && tokenFirst.closed === true) {
				// Verify that the single token is a self-closing tag, and return a
				// new element without children.
				return {
					type: tokenFirst.value,
					attributes: tokenFirst.attributes,
					children: []
				};
			} else {
				return new ParseError(parseErrorMessage("Parser expected a self-closing tag or text."), start, end);
			}
		} else {
			// If the input size is greater than one, it must be a full element with
			// both opening and closing tags that match.
			if (tokenFirst.type === "tagOpen" && tokenLast.type === "tagClose" && tokenFirst.value === tokenLast.value) {
				// Attempt to parse the inner contents as children. They must be valid
				// for the element parse to succeed.
				var children = parseElements(start + 1, end - 1, tokens);

				if (children instanceof ParseError) {
					return new ParseError(parseErrorMessage("Parser expected valid child elements but encountered an error."), start, end, children);
				} else {
					return {
						type: tokenFirst.value,
						attributes: tokenFirst.attributes,
						children: children
					};
				}
			} else {
				return new ParseError(parseErrorMessage("Parser expected an element with matching opening and closing tags."), start, end);
			}
		}
	}
	/**
	 * Parser
	 *
	 * The parser is responsible for taking a list of tokens to return an abstract
	 * syntax tree of a view template. The start and end index are passed around
	 * because it is a recursive function that is called on various sections of the
	 * tokens. Instead of passing down slices of the tokens, it is much more
	 * efficient to keep the same reference and pass new ranges. The start index is
	 * inclusive, and the end index is exclusive.
	 *
	 * The parser is built up of other parsers, including `parseElement()` and
	 * `parseElements()`. Each parser is responsible for taking an input with a
	 * length within a certain range. A parser has a set of alternates that are
	 * matched *exactly* to the input. Each alternate distributes the input in
	 * various ways across other parsers in every possible way. If an alternate
	 * matches, it is returned as a new node in the tree. If it doesn't, and any
	 * other alternates don't match either, then it returns an error.
	 *
	 * The simplest possible parser takes an input and ensures that it matches a
	 * certain sequence of tokens. This parser is built from the following
	 * structure:
	 *
	 * Element -> TagSelfClosing | TagOpen Elements TagClose
	 * Elements -> Empty | Element Elements
	 *
	 * In this case, `TagSelfClosing`, `TagOpen`, and `TagClose` are primitive
	 * parsers that ensure that the input token matches their respective token
	 * type.
	 *
	 * @param {Object[]} tokens
	 * @returns {Object} Abstract syntax tree or ParseError
	 */


	function parse(tokens) {
		var tree = parseElement(0, tokens.length, tokens);

		if ("development" === "development" && tree instanceof ParseError) {
			// Append error messages and print all of them with their corresponding
			// locations in the source.
			var parseErrors = "";
			var parseError = tree;

			do {
				parseErrors += "\n\n" + parseError.message + "\n"; // Collect the tokens responsible for the error as well as the
				// surrounding tokens.

				for (var i = Math.max(0, parseError.start - 2); i < Math.min(parseError.end + 2, tokens.length); i++) {
					parseErrors += tokenString(tokens[i]);
				}
			} while ((parseError = parseError.next) !== undefined);

			error("Parser failed to process the view." + parseErrors);
		}

		return tree;
	}

	/**
	 * Generator
	 *
	 * The generator is responsible for generating a function that creates a view.
	 * A view could be represented as a normal set of recursive function calls, but
	 * it uses lightweight objects to represent them instead. This allows the
	 * executor to execute the function over multiple frames with its own
	 * representation of the stack.
	 *
	 * @param {Object} element
	 * @returns {string} View function code
	 */

	function generate(element) {
		var type;
		var name = element.type;

		if (name === "text") {
			type = types.text;
		} else if (name[0] === name[0].toLowerCase()) {
			type = types.element;
		} else {
			type = types.component;
		}

		var data = "{";

		for (var attribute in element.attributes) {
			data += "\"" + attribute + "\":" + element.attributes[attribute] + ",";
		}

		data += "children:[";
		var separator = "";

		for (var i = 0; i < element.children.length; i++) {
			data += separator + generate(element.children[i]);
			separator = ",";
		}

		return "{type:" + type + ",name:\"" + name + "\",data:" + data + "]}}";
	}

	function compile(input) {
		return generate(parse(lex(input)));
	}

	/**
	 * Global data
	 */
	var data = {};
	/**
	 * Global views
	 */

	var viewOld, viewNew, viewCurrent;
	/**
	 * Global component store
	 */

	var components = {};
	/**
	 * Set old view to a new object.
	 * @param {Object} viewOld
	 */

	function setViewOld(viewOldNew) {
		viewOld = viewOldNew;
	}
	/**
	 * Set new view to a new object.
	 * @param {Object} viewOld
	 */

	function setViewNew(viewNewNew) {
		viewNew = viewNewNew;
	}
	/**
	 * Set current view to a new function.
	 * @param {Function} viewCurrentNew
	 */

	function setViewCurrent(viewCurrentNew) {
		viewCurrent = viewCurrentNew;
	}

	/**
	 * Start time
	 */

	var executeStart;
	/**
	 * Execution queue
	 */

	var executeQueue = [];
	/**
	 * Types of patches
	 */

	var patchTypes = {
		updateText: 0,
		setAttributes: 1,
		appendElement: 2,
		removeElement: 3,
		replaceElement: 4
	};
	/**
	 * Creates a DOM element from a view node.
	 *
	 * @param {Object} node
	 * @returns {Object} node to be used as an old node
	 */

	function executeCreate(node) {
		var nodeType = node.type;
		var nodeName = node.name;
		var nodeData = {};
		var nodeChildren = [];
		var nodeNode;

		if (nodeType === types.element) {
			nodeNode = document.createElement(node.name); // Set data and attributes.

			var _data = node.data;

			for (var key in _data) {
				var value = _data[key];

				if (key !== "children") {
					nodeData[key] = value;
					nodeNode.setAttribute(key, value);
				}
			} // Recursively append children.


			var children = _data.children;

			for (var i = 0; i < children.length; i++) {
				var child = executeCreate(children[i]);
				nodeChildren.push(child);
				nodeNode.appendChild(child.node);
			}
		} else {
			// Get text content using the default data key.
			var textContent = node.data[""]; // Create a text node using the text content.

			nodeNode = document.createTextNode(textContent); // Set only the default data key.

			nodeData[""] = textContent;
		} // Set the children of the new old node.


		nodeData.children = nodeChildren; // Return a new node with copied properties of the original node. This is to
		// prevent bugs from hoisting. When the new nodes are compared to the old
		// ones, the old ones are modified, and the new ones are immutable.

		return {
			type: nodeType,
			name: nodeName,
			data: nodeData,
			node: nodeNode
		};
	}
	/**
	 * Walks through the view and executes components.
	 *
	 * @param {Array} nodes
	 * @param {Array} parents
	 * @param {Array} indexes
	 */


	function executeView(nodes, parents, indexes) {
		while (true) {
			var node = nodes.pop();
			var parent = parents.pop();
			var index = indexes.pop();

			if (node.type === types.component) {
				// Execute the component to get the component view.
				node = components[node.name](node.data); // Set the root view or current node to the new component view.

				if (parent === null) {
					setViewNew(node);
				} else {
					parent.data.children[index] = node;
				}
			} else if (parent === null) {
				// If there is no parent, set the root new view to the current node.
				setViewNew(node);
			} // Execute the views of the children.


			var children = node.data.children;

			for (var i = 0; i < children.length; i++) {
				nodes.push(children[i]);
				parents.push(node);
				indexes.push(i);
			}

			if (nodes.length === 0) {
				// Move to the diff phase if there is nothing left to do.
				executeDiff([viewOld], [viewNew], []);
				break;
			} else if (performance.now() - executeStart >= 16) {
				// If the current frame doesn't have sufficient time left to keep
				// running then continue executing the view in the next frame.
				requestAnimationFrame(function () {
					executeStart = performance.now();
					executeView(nodes, parents, indexes);
				});
				break;
			}
		}
	}
	/**
	 * Finds changes between a new and old tree and creates a list of patches to
	 * execute.
	 *
	 * @param {Array} nodesOld
	 * @param {Array} nodesNew
	 * @param {Array} patches
	 */


	function executeDiff(nodesOld, nodesNew, patches) {
		while (true) {
			var nodeOld = nodesOld.pop();
			var nodeNew = nodesNew.pop();

			if (nodeOld === nodeNew) {
				// If they have the same reference (hoisted) then skip diffing.
				continue;
			} else if (nodeOld.name !== nodeNew.name) {
				// If they have different names, then replace the old node with the
				// new one.
				patches.push({
					type: patchTypes.replaceElement,
					nodeOld: nodeOld,
					nodeNew: nodeNew,
					nodeParent: null
				});
			} else if (nodeOld.type === types.text) {
				// If they both are text, then update the text content.
				patches.push({
					type: patchTypes.updateText,
					nodeOld: nodeOld,
					nodeNew: nodeNew,
					parent: null
				});
			} else {
				// If they both are normal elements, then set attributes and diff the
				// children for appends, deletes, or recursive updates.
				patches.push({
					type: patchTypes.setAttributes,
					nodeOld: nodeOld,
					nodeNew: nodeNew,
					nodeParent: null
				});
				var childrenOld = nodeOld.data.children;
				var childrenNew = nodeNew.data.children;
				var childrenOldLength = childrenOld.length;
				var childrenNewLength = childrenNew.length;

				if (childrenOldLength === childrenNewLength) {
					// If the children have the same length then update both as usual.
					for (var i = 0; i < childrenOldLength; i++) {
						nodesOld.push(childrenOld[i]);
						nodesNew.push(childrenNew[i]);
					}
				} else if (childrenOldLength > childrenNewLength) {
					// If there are more old children than new children, update the
					// corresponding ones and remove the extra old children.
					for (var _i = 0; _i < childrenNewLength; _i++) {
						nodesOld.push(childrenOld[_i]);
						nodesNew.push(childrenNew[_i]);
					}

					for (var _i2 = childrenNewLength; _i2 < childrenOldLength; _i2++) {
						patches.push({
							type: patchTypes.removeElement,
							nodeOld: childrenOld[_i2],
							nodeNew: null,
							nodeParent: nodeOld
						});
					}
				} else {
					// If there are more new children than old children, update the
					// corresponding ones and append the extra new children.
					for (var _i3 = 0; _i3 < childrenOldLength; _i3++) {
						nodesOld.push(childrenOld[_i3]);
						nodesNew.push(childrenNew[_i3]);
					}

					for (var _i4 = childrenOldLength; _i4 < childrenNewLength; _i4++) {
						patches.push({
							type: patchTypes.appendElement,
							nodeOld: null,
							nodeNew: childrenNew[_i4],
							nodeParent: nodeOld
						});
					}
				}
			}

			if (nodesOld.length === 0) {
				// Move to the patch phase if there is nothing left to do.
				executePatch(patches);
				break;
			} else if (performance.now() - executeStart >= 16) {
				// If the current frame doesn't have sufficient time left to keep
				// running then continue diffing in the next frame.
				requestAnimationFrame(function () {
					executeStart = performance.now();
					executeDiff(nodesOld, nodesNew, patches);
				});
				break;
			}
		}
	}
	/**
	 * Applies the list of patches as DOM updates.
	 *
	 * @param {Array} patches
	 */


	function executePatch(patches) {
		for (var i = 0; i < patches.length; i++) {
			var patch = patches[i];

			switch (patch.type) {
				case patchTypes.updateText:
					{
						// Update text of a node with new text.
						var nodeOld = patch.nodeOld;
						var nodeNewText = patch.nodeNew.data[""];
						nodeOld.data[""] = nodeNewText;
						nodeOld.node.textContent = nodeNewText;
						break;
					}

				case patchTypes.setAttributes:
					{
						// Set attributes of a node with new data.
						var _nodeOld = patch.nodeOld;
						var nodeOldData = _nodeOld.data;
						var nodeOldNode = _nodeOld.node;
						var nodeNewData = patch.nodeNew.data; // Mutate the old node with the new node's data and set attributes
						// on the DOM node.

						for (var key in nodeNewData) {
							var value = nodeNewData[key];

							if (key !== "children") {
								nodeOldData[key] = value;
								nodeOldNode.setAttribute(key, value);
							}
						}

						break;
					}

				case patchTypes.appendElement:
					{
						// Append a node. Creates a new old node because the old node must
						// be mutable while the new nodes are mutable.
						var nodeNew = patch.nodeNew;
						var nodeParent = patch.nodeParent;
						var nodeOldNew = executeCreate(nodeNew);
						nodeParent.data.children.push(nodeOldNew);
						nodeParent.node.appendChild(nodeOldNew.node);
						break;
					}

				case patchTypes.removeElement:
					{
						// Remove a node from the parent.
						var _nodeParent = patch.nodeParent; // Pops the last child because the patches still hold a reference
						// to them. The diff phase can only create this patch when there
						// are extra old children, and popping nodes off of the end is more
						// efficient than removing at a specific index, especially because
						// they are equivalent in this case.

						_nodeParent.data.children.pop();

						_nodeParent.node.removeChild(patch.nodeOld.node);

						break;
					}

				case patchTypes.replaceElement:
					{
						// Replaces an old node with a new node.
						var _nodeOld2 = patch.nodeOld;
						var _nodeNew = patch.nodeNew;

						var _nodeOldNew = executeCreate(_nodeNew);

						var _nodeOldNode = _nodeOld2.node; // Mutate the old node with the copied data from creating the new
						// old node, replacing the old DOM node reference.

						_nodeOld2.type = _nodeOldNew.type;
						_nodeOld2.name = _nodeOldNew.name;
						_nodeOld2.data = _nodeOldNew.data;
						_nodeOld2.node = _nodeOldNew.node; // Replace the old node using the reference created before updating
						// the old node.

						_nodeOldNode.parentNode.replaceChild(_nodeOld2.node, _nodeOldNode);

						break;
					}
			}
		} // Remove the current execution from the queue.


		executeQueue.shift(); // If there is new data in the execution queue, continue to it.

		if (executeQueue.length !== 0) {
			if (performance.now() - executeStart >= 16) {
				// If the current frame doesn't have sufficient time left to keep
				// running then start the next execution in the next frame.
				requestAnimationFrame(function () {
					executeStart = performance.now();
					executeNext();
				});
			} else {
				executeNext();
			}
		}
	}
	/**
	 * Execute the next update in the execution queue.
	 */


	function executeNext() {
		// Get the next data update.
		var dataNew = executeQueue[0]; // Merge new data into current data.

		for (var key in dataNew) {
			data[key] = dataNew[key];
		} // Begin executing the view.


		executeView([viewCurrent(data)], [null], [0]);
	}
	/**
	 * Executor
	 *
	 * The executor runs in three phases.
	 *
	 * 1. View
	 * 2. Diff
	 * 3. Patch
	 *
	 * The view phase consists of walking the new tree and executing components.
	 * This is done over multiple frames because component views can be slow, and
	 * component trees can also be large enough to require it.
	 *
	 * The diff phase consists of walking the old and new tree while finding
	 * differences. The differences are pushed as individual patches to a global
	 * list of them. This is run over multiple frames because finding differences
	 * between large component trees can take a while, especially from long lists.
	 *
	 * The patch phase consists of iterating through the patches and applying all
	 * of them to mutate the DOM. These boil down to primitive DOM operations that
	 * are all batched together to update the view. Rather than doing it along with
	 * the diff phase, the patch is done in one frame to prevent an inconsistent
	 * UI -- similar to screen tearing.
	 *
	 * @param {Object} dataNew
	 */


	function execute(dataNew) {
		// Push the new data to the execution queue.
		executeQueue.push(dataNew); // Execute the next function in the queue if none are scheduled yet.

		if (executeQueue.length === 1) {
			requestAnimationFrame(function () {
				executeStart = performance.now();
				executeNext();
			});
		}
	}

	/**
	 * Moon
	 *
	 * Creates a new Moon component or root based on given options. Each Moon
	 * component is independent and has no knowledge of the parent. A component is
	 * a function mapping data to a view. The component can update global data to
	 * recreate the view. In Moon, the view is defined as a function over data, and
	 * components are just helper functions.
	 *
	 * The data can have a `root` property with an element. Moon will automatically
	 * create the component and append it to the root element provided. This makes
	 * the data the source of true state that is accessible for updates by every
	 * component.
	 *
	 * The data must have a `view` property with a string template or precompiled
	 * functions.
	 *
	 * The rest of the data is custom and can be thought of as a default. This data
	 * is immutable, and the component updates global data instead of having local
	 * state.
	 *
	 * @param {Object} options
	 * @param {string} [options.name]
	 * @param {Node|string} [options.root]
	 * @param {Object|string} options.view
	 */

	function Moon(options) {
		// Handle the optional `name` parameter.
		var name = defaultValue(options.name, "Root");
		delete options.name; // Ensure the view is defined, and compile it if needed.

		var view = options.view;
		delete options.view;

		if ("development" === "development" && view === undefined) {
			error("The " + name + " component requires a \"view\" property.");
		}

		if (typeof view === "string") {
			view = new Function("data", "return " + compile(view));
		} // If a `root` option is given, start the root renderer, or else just return
		// the component.


		var root = typeof options.root === "string" ? document.querySelector(options.root) : options.root;
		delete options.root;

		if (root === undefined) {
			components[name] = function (data) {
				return view(defaultObject(data, options));
			};
		} else {
			setViewOld({
				type: types.element,
				name: root.tagName.toLowerCase(),
				data: {
					children: []
				},
				node: root
			});
			setViewCurrent(view);
			execute(options);
		}
	}
	Moon.lex = lex;
	Moon.parse = parse;
	Moon.generate = generate;
	Moon.compile = compile;
	Moon.components = components;
	Moon.set = execute;

	return Moon;
}));
