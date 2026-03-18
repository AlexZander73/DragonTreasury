interface HelpPopoverProps {
  open: boolean;
  onClose: () => void;
}

export const HelpPopover = ({ open, onClose }: HelpPopoverProps) => {
  if (!open) {
    return null;
  }

  return (
    <section className="help-popover" aria-label="How to use The Hoard">
      <header>
        <h2>How to Explore</h2>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </header>
      <ul>
        <li>Drag and toss relics to disturb the pile.</li>
        <li>Single click selects an item. Double click inspects lore.</li>
        <li>Use arrange modes for timeline/category/era reveals.</li>
        <li>Try interacting with the dragon repeatedly for hidden events.</li>
        <li>Enable Browse List for a keyboard-first archive mode.</li>
      </ul>
    </section>
  );
};
