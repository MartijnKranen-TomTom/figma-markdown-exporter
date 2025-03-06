type Hyperlink = {
  type: "URL" | "NODE";
  value: string;
  openInNewTab?: boolean;
};

type NodeRange = {
  start: number;
  end: number;
  textDecoration: string;
  characters: string;
  listOptions: TextListOptions;
  fontSize: number;
  fontWeight: number;
  hyperlink: Hyperlink | null;
};

// async function convertImageNodeToBlob(node: RectangleNode) {
//   if (Array.isArray(node.fills)) {
//     for (const paint of node.fills) {
//       if (paint.type === "IMAGE") {
//         const image = figma.getImageByHash(paint.imageHash);
//         if (image) {
//           return await image.getBytesAsync();
//           // const s = String.fromCharCode(...bytes);
//         }
//       }
//     }
//   }
// }

// async function getImageBlobs(nodes: SceneNode[]): Promise<string[]> {
//   const blobs = await Promise.all(
//     nodes
//       .filter((node) => node.visible)
//       .map(async (node) => {
//         if (node.type === "RECTANGLE") {
//           return convertImageNodeToBlob(node);
//         } else if (node.type === "FRAME" || node.type === "INSTANCE" || node.type === "GROUP") {
//           return await getImageBlobs(node.children.slice());
//         }
//       })
//   );
//   return blobs.filter((blob) => blob !== undefined).flat();
// }

function convertImageNodeToMarkdown(node: RectangleNode) {
  if (Array.isArray(node.fills)) {
    for (const paint of node.fills) {
      if (paint.type === "IMAGE") {
        return `![${node.name}](files/${node.name}.png)`;
      }
    }
  }
}

const formatLabel = (value: string) =>
  `  - label: "${value}"
    color: grey5`;

const formatLabels = (labels: string[]) => {
  if (labels.length === 0) {
    return "";
  }

  const labelStrings = labels.map((label) => formatLabel(label)).join("\n");
  return `titleTags:
${labelStrings}`;
};

const formatIntroWithLabels = (title: string, labels: string[]) => {
  return `---
title: ${title}
${formatLabels(labels)}
hideSubmenu: true
---`;
};

function createTable(node: SceneNode) {
  // Todo: add check for table
  if (node.type !== "COMPONENT" && node.type !== "INSTANCE") {
    return;
  }

  const elements = node.children.filter((child) => child.type === "FRAME");
  const headers = elements[0].children.map((child) => convertNodesToMarkdown([child]));
  const dataRows = elements.slice(1).map((node) => convertNodesToMarkdown(node.children.slice(), " | ", false));

  const headerString = `| ${headers.join(" | ")} |`;
  const headerSeparator = `|  ${headers.map(() => "--------").join(" | ")} |`;
  const dataRowsString = `| ${dataRows.join(" |\n|")} |`;

  return `
${headerString}
${headerSeparator}
${dataRowsString}
`;
}

function convertNodesToMarkdown(nodes: SceneNode[] | FrameNode[], separator = "\n", addNewlines = true): string {
  return nodes
    .filter((node) => node.visible)
    .map((node) => {
      if (node.type === "FRAME" && node.name === "Header") {
        let title;
        const labels: string[] = [];

        for (const child of node.children) {
          if (!child.visible) {
            continue;
          }

          if (child.type === "TEXT" && child.name === "Page title") {
            title = child.characters;
          } else if (child.name === "Tags" && child.type === "FRAME") {
            for (const tagNode of child.children) {
              if ((tagNode.type === "COMPONENT" || tagNode.type === "INSTANCE") && tagNode.children.length > 0) {
                const child = tagNode.children[0];
                if (child.type === "TEXT") {
                  if (tagNode.name === "Last edit") {
                    labels.push(`Last edit: ${child.characters}`);
                  } else if (tagNode.name === "Version") {
                    labels.push(`Version: ${child.characters}`);
                  }
                }
              }
            }
          }
        }

        if (title) {
          return formatIntroWithLabels(title, labels);
        }
      } else if (
        (node.type === "COMPONENT" || node.type === "INSTANCE") &&
        (node.name === "Highlight" || node.name === "Blockquote")
      ) {
        for (const child of node.children) {
          if (child.type === "TEXT") {
            return convertTextNodeToMarkdown(child, "code");
          }
        }
      } else if (
        (node.type === "COMPONENT" || node.type === "INSTANCE") &&
        (node.name === "User prompt" || node.name === "Assistant prompt")
      ) {
        const contentNode = node.children[0] as FrameNode;
        const type = node.name === "User prompt" ? "user" : "assistant";

        for (const child of contentNode.children) {
          if (child.type === "TEXT") {
            return `<SpeechBubble type="${type}">${convertTextNodeToMarkdown(child)}</SpeechBubble>`;
          }
        }
      } else if ((node.type === "COMPONENT" || node.type === "INSTANCE") && node.name === "Table") {
        return createTable(node);
      } else if (node.type === "TEXT") {
        return convertTextNodeToMarkdown(node);
      } else if (node.type === "RECTANGLE") {
        return `\n${convertImageNodeToMarkdown(node)}`;
      } else if (
        node.type === "FRAME" ||
        node.type === "INSTANCE" ||
        node.type === "GROUP" ||
        node.type === "COMPONENT"
      ) {
        return `${node.children
          .map((child) => convertNodesToMarkdown([child], separator, addNewlines))
          .join(addNewlines ? "\n" : "")}`;
      } else {
        console.error(`Unsupported type: ${node.type}`);
      }
    })
    .join(separator)
    .replace(/\n{3,}/g, "\n\n");
}

function convertTextNodeToMarkdown(node: TextNode, containerStyle?: string): string {
  return node
    .getStyledTextSegments(["fontSize", "textDecoration", "listOptions", "fontWeight", "hyperlink"])
    .map((range) => {
      const nodeMarkdown = convertRangeToMarkdown(range);
      if (!nodeMarkdown) {
        return "";
      }

      return addContainerMarkdown(nodeMarkdown, containerStyle);
    })
    .join("")
    .trim();
}

function addContainerMarkdown(text: string, containerStyle?: string) {
  if (containerStyle === "code") {
    return text
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
  }

  return text;
}

function convertRangeToMarkdown(range: NodeRange) {
  if (range.characters.length > 1) {
    if (range.listOptions.type === "UNORDERED") {
      const lines = range.characters.split("\n");
      return (
        "\n" +
        lines
          .filter((line: string) => line !== "")
          .map((line: string) => `* ${line}`)
          .join("\n") +
        "\n"
      );
    } else if (range.hyperlink) {
      // Convert to relative link if no dot in the URL
      let link = range.hyperlink.value;
      if (range.hyperlink.value.indexOf(".") < 0) {
        link = link.replace("http://", "").replace("https://", "");
      }
      return `[${range.characters}](${link})`;
    } else if (range.fontSize === 40) {
      return `# ${range.characters}\n`;
    } else if (range.fontSize === 32) {
      return `## ${range.characters}\n`;
    } else if (range.fontSize === 28) {
      return `### ${range.characters}\n`;
    } else if (range.fontWeight === 700) {
      return ` **${range.characters.trim()}**`;
    } else {
      return range.characters;
    }
  }
}

async function main() {
  const markdown = convertNodesToMarkdown(Array.from(figma.currentPage.selection));

  figma.showUI(__html__, { themeColors: true, width: 800, height: 400 });
  figma.ui.postMessage({ type: "markdown", content: markdown });

  // const imageBlobs = await getImageBlobs(Array.from(figma.currentPage.selection));
  // figma.ui.postMessage({ type: "images", content: imageBlobs });
}

main();

// figma.closePlugin();
