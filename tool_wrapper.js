const scriptSrc = document.currentScript?.src;

(async function () {
  const url = new URL(scriptSrc);
  const toolId = url.searchParams.get("tool_id");
  const container = url.searchParams.get("container");
  var toolObj = {};
  window.bridges = window.bridges || {};

  const libUrl = "https://onlinetools.com/js/libs/";
  const bridgeUrl = "https://onlinetools.com/js/bridges/";
  const configUrl =
    "https://service-files.vercel.app/site-onlinestringtools-config.json";
  const htmlComponentUrl = "https://service-files.vercel.app/";
  const cssUrl = "https://service-files.vercel.app/tool-css.css";

  const outerLibNames = {
    "grapheme-splitter": "grapheme-splitter.min",
  };

  let bridge;
  let runtimeContext;
  let inputField;
  let outputField;
  let optionsWrapper;
  let panel;
  let inputsWrapper;
  let exampleNumber = 0;

  if (!String.prototype.format) {
    String.prototype.format = function () {
      var args = arguments;
      return this.replace(/{(\d+)}/g, function (match, index) {
        return typeof args[index] !== "undefined" ? args[index] : match;
      });
    };
  }

  async function loadData(toolId) {
    const res = await fetch(configUrl);
    const config = await res.json();
    const toolObj = config.tools.find((item) => item.url === toolId);
    return toolObj;
  }

  async function loadFiles(globalPath, files) {
    if (files !== undefined)
      await Promise.all(files.map((f) => loadSingleFile(globalPath, f)));
  }

  function loadSingleFile(globalPath, file) {
    return new Promise((resolve, reject) => {
      const currentScript = document.createElement("script");
      var fileName = file;
      if (fileName in outerLibNames) {
        fileName = outerLibNames[fileName];
      }
      currentScript.src = `${globalPath}${fileName}.js`;
      currentScript.async = false;
      currentScript.onload = () => resolve();
      currentScript.onerror = () =>
        reject(new Error("Failed to load " + fileName));
      document.head.appendChild(currentScript);
    });
  }

  var toolObj = await loadData(toolId);
  await loadFiles(libUrl, toolObj.libraries);
  await loadSingleFile(bridgeUrl, toolObj.bridge);

  function resolveBridgeExecutor(name) {
    const factory = window.bridges[name];
    if (!factory) throw new Error("Bridge not found: " + name);

    const instance = factory();

    if (instance && typeof instance.converter === "function") {
      return instance.converter;
    }

    throw new Error("Unsupported bridge format: " + name);
  }

  bridge = resolveBridgeExecutor(toolObj.bridge);

  runtimeContext = {
    options: null,
  };

  await loadSingleFile(htmlComponentUrl, "html-component");
  includeFileCSS(cssUrl);

  function createOptionsGetter(wrapper) {
    return {
      get() {
        const result = {};
        const elements = wrapper.querySelectorAll('[data-type="options"]');

        elements.forEach((el) => {
          const key = el.dataset.index;
          if (!key) return;

          if (el.type === "checkbox") {
            result[key] = el.checked;
          } else if (el.type === "radio") {
            if (el.checked) {
              result[key] = el.value;
            }
          } else {
            result[key] = el.value;
          }
        });

        return result;
      },
    };
  }

  //////ui
  async function init() {
    panel = HtmlElement.getById(container);

    inputsWrapper = HtmlElement.create({
      type: "div",
      classes: "ext-0x03-inputs-wrapper",
      id: "ext-0x03-inputs-wrapper",
      styles: {
        width: "100%",
        height: "auto",
      },
    }).appendTo(panel);

    HtmlElement.create({
      type: "div",
      classes: "ext-0x03-tool-title",
      value: toolObj.name,
    }).appendTo(inputsWrapper);

    HtmlElement.create({
      type: "div",
      classes: "ext-0x03-inputs-title-wrapper",
      id: "ext-0x03-input-title-wrapper",
    })
      .addChild({
        type: "div",
        classes: "ext-0x03-main-text",
        id: "ext-0x03-main-input-name",
        value: toolObj.from,
      })
      .appendTo(inputsWrapper);

    inputField = HtmlElement.create({
      type: "textarea",
      id: "ext-0x03-input-textarea",
      classes: "brwl-0x03-input ext-0x03-textarea-field",
      events: {
        blur: () => decodeInputToOutput(),
        input: () => decodeInputToOutput(),
      },
    }).appendTo(inputsWrapper);

    HtmlElement.create({
      type: "div",
      classes: "ext-0x03-inputs-title-wrapper",
      id: "ext-0x03-output-title-wrapper",
    })
      .addChild({
        type: "div",
        classes: "ext-0x03-main-text",
        id: "ext-0x03-main-output-name",
        value: toolObj.to,
      })
      .appendTo(inputsWrapper);

    outputField = HtmlElement.create({
      type: "textarea",
      id: "ext-0x03-output-textarea",
      classes: "brwl-0x03-input ext-0x03-textarea-field",
    }).appendTo(inputsWrapper);

    optionsWrapper = HtmlElement.create({
      type: "div",
      id: "ext-0x03-options-wrapper",
      classes: "ext-0x03-options-wrapper",
    }).appendTo(inputsWrapper);

    drawOptions(toolObj);

    examplesWrapper = HtmlElement.create({
      type: "div",
      id: "ext-0x03-examples-wrapper",
      classes: "ext-0x03-examples-wrapper",
    }).appendTo(inputsWrapper);

    if (toolObj.examples && toolObj.examples.length > 0) {
      toolObj.examples.forEach((example) =>
        examplesWrapper.append(drawExample(example)),
      );
    }
  }

  function drawExample(exObj) {
    exampleNumber++;
    /*
  {
      "title": "String with HTML",
      "description": "In this example, we HTML-escape a string that contains regular HTML code. Character &lt; gets converted to &amp;lt; (lt stands for less than) and character > gets converted to &gt; (gt stands for greater than). All other characters don't change as they're not special in HTML.",
      "input": "<p>A paragraph a <u>day</u>, keeps the <u>doctor</u> away.</p>",
      "output":"&lt;p&gt;A paragraph a &lt;u&gt;day&lt;/u&gt;, keeps the &lt;u&gt;doctor&lt;/u&gt; away.&lt;/p&gt;",
      "options": {
          "special-symbols" : true,
          "decimal" : true,
          "named": true
      }
  },  
   */
    const exampleElem = HtmlElement.create({
      type: "div",
      classes: "ext-0x03-example",
      events: {
        click: (e) => parseExample(e),
      },
    })
      .addChild({
        type: "div",
        value: exObj.title,
        classes: "ext-0x03-example-title",
      })
      .addChild({
        type: "div",
        value: exObj.description,
        classes: "ext-0x03-example-description",
      })
      .addChild({
        type: "div",
        value: exObj.input,
        classes: "ext-0x03-example-input",
      })
      .addChild({
        type: "div",
        value: "\u2193",
        styles: {
          "font-size": "20px",
          "text-align": "center",
        },
      })
      .addChild({
        type: "div",
        value: exObj.output,
        classes: "ext-0x03-example-output",
      });

    if (exObj.options) {
      exampleElem
        .addChild({
          type: "div",
          value: "Required options",
          styles: {
            "font-size": "18px",
            "font-weight": "bold",
          },
        })
        .addChild({
          type: "div",
          value:
            "These options will be used automatically if you select this example.",
          styles: {
            "font-size": "16px",
          },
        });

      Object.keys(exObj.options).forEach((option) => {
        let attr = `[data-index="${option}"]`;
        let buttonElem = document
          .querySelector(attr)
          .parentElement.cloneNode(true);
        let button = buttonElem.querySelector("input");
        let label = buttonElem.querySelector("label");
        button.setAttribute("name", `${button.name}_${exampleNumber}`);
        button.disabled = true;
        button.id = `${button.id}_${exampleNumber}`;
        label.setAttribute("for", button.id);
        let buttonHtmlElem = HtmlElement.create(button);
        buttonHtmlElem.setValue(exObj.options[option]);
        exampleElem.element.append(buttonElem);
      });
    }
    return exampleElem;
  }

  function parseExample(e) {
    const example = e.currentTarget;
    const exInput = example.querySelector(
      ".ext-0x03-example-input",
    ).textContent;
    inputField.setValue(exInput);
    const exOutput = example.querySelector(
      ".ext-0x03-example-output",
    ).textContent;
    outputField.setValue(exOutput);

    const exOptions = example.querySelectorAll('[data-type="options"]');
    console.log(exOptions);
    const realOptionsList = document.querySelector(".ext-0x03-options-wrapper");
    exOptions.forEach((option) => {
      const dataSelector = `[data-type="options"][data-index="${option.getAttribute("data-index")}"]`;
      const realOption = realOptionsList.querySelector(dataSelector);
      if (
        option.getAttribute("data-action") === "radio" ||
        option.getAttribute("data-action") === "checkbox"
      ) {
        realOption.checked = option.checked;
      } else if (option.getAttribute("data-action") === "text") {
        realOption.value = option.value;
      }
    });

    inputField.element.focus();
  }

  function createCheckbox(button, currentGroup, groupName) {
    /*
      <input class="checkbox__input input-option" 
      type="checkbox" 
      id="option-encode-all-chars-35b6cf1f" 
      required="" 
      name="option-group-35b6cf1f-0" 
      data-index="encode-all-chars" 
      data-action="checkbox" 
      data-type="options" 
      data-clicked="0">
    */
    let currentElem = HtmlElement.create({
      type: "div",
      classes: "ext-0x03-checkbox",
    })
      .addChildWithLabel({
        type: "input",
        attrs: {
          type: "checkbox",
          name: `ext-0x03-${groupName}`,
          "data-index": button.name,
          "data-action": "checkbox",
          "data-type": "options",
          "data-clicked": "0",
        },
        events: {
          change: () => decodeInputToOutput(),
        },
        id: `ext-0x03-${button.name}`,
        classes: "ext-0x03-checkbox__input",
        value: button.value,
        label_value: button.label,
        label_classes: "ext-0x03-checkbox__label",
      })
      .appendTo(currentGroup);

    if (button.comment) {
      HtmlElement.create({
        type: "div",
        classes: "ext-0x03-text__supporting",
      })
        .addChild({
          type: "span",
          value: button.comment,
        })
        .appendTo(currentGroup);
    }

    return currentElem;
  }
  function createRadio(button, currentGroup, groupName) {
    /*
      <input class="radio__input input-option" 
      type="radio" 
      checked="" 
      id="option-all-symbols-e8a8e3d8" 
      required="" 
      name="option-group-e8a8e3d8-0" 
      data-index="all-symbols" 
      data-action="radio" 
      data-type="options" 
      data-clicked="0">
    */
    let currentElem = HtmlElement.create({
      type: "div",
      classes: "ext-0x03-radio",
    })
      .addChildWithLabel({
        type: "input",
        attrs: {
          type: "radio",
          name: `ext-0x03-${groupName}`,
          "data-index": button.name,
          "data-action": "radio",
          "data-type": "options",
          "data-clicked": "0",
        },
        events: {
          change: () => decodeInputToOutput(),
        },
        id: `ext-0x03-${button.name}`,
        classes: "ext-0x03-radio__input",
        value: button.value,
        label_value: button.label,
        label_classes: "ext-0x03-radio__label",
      })
      .appendTo(currentGroup);

    if (button.comment) {
      currentGroup
        .addAndReturnChild({
          type: "div",
          classes: "ext-0x03-text__supporting",
        })
        .addChild({
          type: "span",
          value: button.comment,
        });
    }

    return currentElem;
  }

  function createText(button, currentGroup, groupName) {
    /*
    <input class="text-field__input input-option" 
    type="text" 
    value="76" 
    placeholder=" " 
    id="option-base64-split-length-3a1dfbc6" 
    required="" 
    name="option-group-3a1dfbc6-0" 
    data-index="base64-split-length" 
    data-action="input" 
    data-type="options" 
    data-clicked="0">   
   */

    let currentElem = HtmlElement.create({
      type: "div",
      classes: "ext-0x03-text-field",
    })
      .addChild({
        type: "input",
        events: {
          change: () => decodeInputToOutput(),
          input: () => decodeInputToOutput(),
        },
        id: `ext-0x03-${button.name}`,
        name: `ext-0x03-${groupName}`,
        classes: "ext-0x03-text-field__input",
        attrs: {
          placeholder: " ",
          "data-index": button.name,
          "data-action": "text",
          "data-type": "options",
          "data-clicked": "0",
        },
        value: button.value,
      })
      .appendTo(currentGroup);

    HtmlElement.create({
      type: "label",
      classes: "ext-0x03-text-field__input__placeholder",
      attrs: {
        for: `ext-0x03-${button.name}`,
      },
    })
      .addChild({
        type: "div",
        classes: "ext-0x03-text-field__input__placeholder__label",
        value: button.label,
      })
      .appendTo(currentElem);

    if (button.comment) {
      currentGroup
        .addAndReturnChild({
          type: "div",
          classes: "ext-0x03-text__supporting",
        })
        .addChild({
          type: "span",
          value: button.comment,
        });
    }

    return currentElem;
  }

  function drawOptions(item) {
    if (item.options) {
      item.options.forEach((group, index) => {
        const groupName = group.group.toLowerCase().replace(/[ -]/g, "_");
        const currentGroup = HtmlElement.create({
          type: "div",
          classes: "ext-0x03-option-group",
        })
          .addChild({
            type: "div",
            classes: "ext-0x03-option-group-name",
            value: group.group,
          })
          .appendTo(optionsWrapper);

        group.buttons.forEach((button) => {
          switch (button.type) {
            case "checkbox":
              createCheckbox(button, currentGroup, groupName);
              break;
            case "radio":
              createRadio(button, currentGroup, groupName);
              break;
            case "text":
              createText(button, currentGroup, groupName);
              break; /*
          case "select":
            currentElem = HtmlElement.create({
              type: "div",
              classes: "ext-0x03-oco-select",
            }).appendTo(decoderElem);

            const selectElem = HtmlElement.create({
              type: "select",
              id: `ext-0x03-${decoderId}-${button.name}`,
              classes: "ext-0x03-oco-select__select",
              attrs: {
                name: `ext-0x03-${groupName}-${button.name}`,
              },
              events: {
                change: () => decodeInputToOutput(),
              },
            }).appendTo(currentElem);

            if (button.optgroups_list) {
              button.optgroups_list.forEach((optgroup) => {
                const optgroupElem = HtmlElement.create({
                  type: "optgroup",
                  attrs: {
                    label: optgroup.name,
                  },
                }).appendTo(selectElem);

                if (optgroup.options_list) {
                  optgroup.options_list.forEach((option) => {
                    const optionElem = HtmlElement.create({
                      type: "option",
                      attrs: {
                        label: option.label,
                      },
                      value: option.value,
                    }).appendTo(optgroupElem);
                  });
                }
              });
            }

            selectElem.setValue(button.value || "");

            if (button.comment) {
              decoderElem
                .addAndReturnChild({
                  type: "div",
                  classes: "ext-0x03-text__supporting",
                })
                .addChild({
                  type: "span",
                  value: button.comment,
                });

              decoderElem.append(smallSeparator.clone());
            }*/
          }
        });
      });
    }
  }

  await init();

  runtimeContext.options = createOptionsGetter(optionsWrapper.element);

  function decodeInputToOutput() {
    if (!bridge || !inputField || !outputField) return;
    const inputValue = inputField.getValue() || "";
    let result;
    try {
      result = bridge.call(runtimeContext, inputValue);
      outputField.setValue(result);
    } catch (err) {
      outputField.setValue(`Bridge execution failed: ${err}`);
    }
  }

  decodeInputToOutput();
})();
