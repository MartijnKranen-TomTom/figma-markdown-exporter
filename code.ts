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
---`;
};

function convertTextNodesToMarkdown(nodes: SceneNode[]): string {
  return nodes
    .filter((node) => node.visible)
    .map((node) => {
      if (node.name === "Header" && node.type === "FRAME") {
        let title;
        const labels: string[] = [];

        for (const child of node.children) {
          if (!child.visible) {
            continue;
          }

          if (child.type === "TEXT" && child.name === "Page title") {
            title = child.characters;
          } else if (child.name === "Tags" && child.type === "FRAME") {
            console.log(child.visible);
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
      } else if (node.type === "TEXT") {
        return convertTextNodeToMarkdown(node);
      } else if (node.type === "RECTANGLE") {
        return convertImageNodeToMarkdown(node);
      } else if (
        node.type === "FRAME" ||
        node.type === "INSTANCE" ||
        node.type === "GROUP" ||
        node.type === "COMPONENT"
      ) {
        return node.children.map((child) => convertTextNodesToMarkdown([child])).join("\n") + "\n";
      } else {
        console.error(`Unsupported type: ${node.type}`);
      }
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

function convertTextNodeToMarkdown(node: TextNode): string {
  return node
    .getStyledTextSegments(["fontSize", "textDecoration", "listOptions", "fontWeight", "hyperlink"])
    .map((range) => convertRangeToMarkdown(range))
    .join("")
    .trim();
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
  const markdown = convertTextNodesToMarkdown(Array.from(figma.currentPage.selection));

  figma.showUI(__html__, { themeColors: true, width: 800, height: 400 });
  figma.ui.postMessage({ type: "markdown", content: markdown });

  // const imageBlobs = await getImageBlobs(Array.from(figma.currentPage.selection));
  // figma.ui.postMessage({ type: "images", content: imageBlobs });
}

main();

// figma.closePlugin();
