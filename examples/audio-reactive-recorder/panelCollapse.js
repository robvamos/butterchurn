export function getNextCollapsedState(currentCollapsed, forceCollapsed) {
  return typeof forceCollapsed === "boolean" ? forceCollapsed : !currentCollapsed;
}

export function syncCollapsedPanelUi({
  button,
  body,
  collapsed,
  expandLabel,
  collapseLabel,
}) {
  if (button) {
    button.classList.toggle("active", !collapsed);
    button.setAttribute("aria-expanded", String(!collapsed));
    button.setAttribute("aria-label", collapsed ? expandLabel : collapseLabel);
    button.title = collapsed ? expandLabel : collapseLabel;
  }
  if (body) {
    body.classList.toggle("hidden", collapsed);
  }
}
