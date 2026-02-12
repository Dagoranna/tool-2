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
    "https://tools-configs.netlify.app/site-onlinestringtools-config.json";
  const htmlComponentUrl = "https://tools-configs.netlify.app/";
  const cssUrl = "https://tools-configs.netlify.app/tool-css.css";

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
      console.log("currentScript.src = " + currentScript.src);
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

  //затычка для сбора опций
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
    }).appendTo(panel);

    HtmlElement.create({
      type: "div",
      styles: {
        "font-size": "16px",
        "font-weight": "bold",
        "text-align": "center",
        margin: "6px",
      },
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
  }

  function drawOptions(item) {
    const bigSeparator = HtmlElement.create({
      type: "div",
      classes: "ext-0x03-options-separator",
      styles: {
        "margin-bottom": "12px",
      },
    });

    const smallSeparator = HtmlElement.create({
      type: "div",
      classes: "ext-0x03-options-separator",
      styles: {
        "margin-bottom": "0px",
      },
    });

    const decoderElem = HtmlElement.create({
      type: "div",
      id: `ext-0x03-options`,
      styles: {
        display: "flex",
      },
      classes: "ext-0x03-options-separate",
    }).appendTo(optionsWrapper);

    if (item.options) {
      item.options.forEach((group, index) => {
        const groupName = group.group.toLowerCase().replace(/[ -]/g, "_");
        group.buttons.forEach((button) => {
          let currentElem;
          switch (button.type) {
            case "checkbox":
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
              currentElem = HtmlElement.create({
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
                .appendTo(decoderElem);

              decoderElem.append(smallSeparator.clone());

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
              }

              break;
            /* case "radio":
            currentElem = HtmlElement.create({
              type: "div",
              classes: "ext-0x03-radio",
            })
              .addChildWithLabel({
                type: "input",
                attrs: {
                  type: "radio",
                  name: `ext-0x03-${decoderId}-${groupName}`,
                },
                events: {
                  change: () => decodeInputToOutput(),
                },
                id: `ext-0x03-${decoderId}-${button.name}`,
                classes: "ext-0x03-radio__input",
                value: button.value,
                label_value: button.label,
                label_classes: "ext-0x03-radio__label",
              })
              .appendTo(decoderElem);

            if (button.tooltip) {
              currentElem.setAttr("data-tooltip", button.tooltip);
            }

            decoderElem.append(smallSeparator.clone());

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
            }

            break;
          case "text":
            currentElem = HtmlElement.create({
              type: "div",
              classes: "ext-0x03-text-field",
            })
              .addChild({
                type: "input",
                events: {
                  change: () => decodeInputToOutput(),
                },
                id: `ext-0x03-${decoderId}-${button.name}`,
                name: `ext-0x03-${decoderId}-${groupName}`,
                classes: "ext-0x03-text-field__input",
                attrs: {
                  placeholder: " ",
                },
                value: button.value,
              })
              .appendTo(decoderElem);

            if (button.tooltip) {
              currentElem.setAttr("data-tooltip", button.tooltip);
            }

            HtmlElement.create({
              type: "label",
              classes: "ext-0x03-text-field__input__placeholder",
              attrs: {
                for: `ext-0x03-${decoderId}-${button.name}`,
              },
            })
              .addChild({
                type: "div",
                classes: "ext-0x03-text-field__input__placeholder__label",
                value: button.label,
              })
              .appendTo(currentElem);

            decoderElem.append(smallSeparator.clone());

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
            }
            break;
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
        if (index < item.options.length - 1)
          decoderElem.append(bigSeparator.clone());
      });
    }
  }

  await init();

  runtimeContext.options = createOptionsGetter(optionsWrapper.element);

  function decodeInputToOutput() {
    if (!bridge || !inputField || !outputField) return;

    try {
      const inputValue = inputField.getValue
        ? inputField.getValue()
        : inputField.value;

      const result = bridge.call(runtimeContext, inputValue || "");

      if (outputField.setValue) outputField.setValue(result ?? "");
      else outputField.value = result ?? "";
    } catch (e) {
      console.error("Tool execution error", e);
    }
  }

  decodeInputToOutput();
})();
