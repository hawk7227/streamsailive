import type { ComponentTemplate } from "./visual-edit-operations";

export const VISUAL_COMPONENT_TEMPLATES: ComponentTemplate[] = [
  {
    id: "panel-basic",
    label: "Panel",
    kind: "panel",
    defaultJsx: `<section className="streams-panel"><h2>New Panel</h2><p>Add your content here.</p></section>`,
    defaultStyles: { backgroundColor: "#0f172a", color: "#ffffff", borderRadius: "16px", padding: "24px" },
    allowedParents: ["page", "section", "container", "panel", "card"],
    editableProps: [
      { name: "backgroundColor", label: "Background", kind: "color", target: "style" },
      { name: "color", label: "Text Color", kind: "color", target: "style" },
      { name: "borderRadius", label: "Radius", kind: "number", target: "style" },
      { name: "padding", label: "Padding", kind: "number", target: "style" },
    ],
  },
  {
    id: "text-paragraph",
    label: "Text",
    kind: "text",
    defaultJsx: `<p className="streams-text">New editable text.</p>`,
    defaultStyles: { color: "#e2e8f0", fontSize: "16px", lineHeight: "28px" },
    allowedParents: ["page", "section", "container", "panel", "card"],
    editableProps: [
      { name: "children", label: "Text", kind: "text", target: "children" },
      { name: "fontSize", label: "Font Size", kind: "number", target: "style" },
      { name: "color", label: "Color", kind: "color", target: "style" },
    ],
  },
  {
    id: "heading-title",
    label: "Heading",
    kind: "heading",
    defaultJsx: `<h2 className="streams-heading">New Heading</h2>`,
    defaultStyles: { color: "#ffffff", fontSize: "30px", fontWeight: "900" },
    allowedParents: ["page", "section", "container", "panel", "card"],
    editableProps: [
      { name: "children", label: "Heading", kind: "text", target: "children" },
      { name: "fontSize", label: "Font Size", kind: "number", target: "style" },
      { name: "color", label: "Color", kind: "color", target: "style" },
    ],
  },
  {
    id: "button-primary",
    label: "Button",
    kind: "button",
    defaultJsx: `<button className="streams-button">New Button</button>`,
    defaultStyles: { backgroundColor: "#7c3aed", color: "#ffffff", borderRadius: "999px", padding: "12px 20px" },
    allowedParents: ["page", "section", "container", "panel", "card"],
    editableProps: [
      { name: "children", label: "Button Text", kind: "text", target: "children" },
      { name: "backgroundColor", label: "Background", kind: "color", target: "style" },
      { name: "color", label: "Color", kind: "color", target: "style" },
    ],
  },
  {
    id: "image-basic",
    label: "Image",
    kind: "image",
    defaultJsx: `<img src="/placeholder-image.png" alt="New image" className="streams-image" />`,
    defaultStyles: { width: "100%", height: "256px", objectFit: "cover", borderRadius: "16px" },
    allowedParents: ["page", "section", "container", "panel", "card"],
    editableProps: [
      { name: "src", label: "Image Source", kind: "asset", target: "prop" },
      { name: "alt", label: "Alt Text", kind: "text", target: "prop" },
      { name: "objectFit", label: "Object Fit", kind: "select", target: "style" },
    ],
  },
  {
    id: "video-basic",
    label: "Video",
    kind: "video",
    defaultJsx: `<video src="/placeholder-video.mp4" controls className="streams-video" />`,
    defaultStyles: { width: "100%", height: "256px", objectFit: "cover", borderRadius: "16px" },
    allowedParents: ["page", "section", "container", "panel", "card"],
    editableProps: [
      { name: "src", label: "Video Source", kind: "asset", target: "prop" },
      { name: "controls", label: "Controls", kind: "boolean", target: "prop" },
    ],
  },
];

export function getComponentTemplate(id: string) {
  return VISUAL_COMPONENT_TEMPLATES.find((template) => template.id === id) || null;
}
