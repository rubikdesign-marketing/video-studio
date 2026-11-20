import { usePanelsStore } from '../shell';
import { formatKeys, TABLE } from '../shortcuts';
import { ThemeSwitch } from '../theme';
import { Field, Icon, MenuItem, Popover } from '../ui';
import { useReviewer } from './reviewer';

/** Your name on notes, the theme, and which panels show. Set once, so kept out of the bar. */
export function YouMenu({ panelNames = { right: 'Notes panel', timeline: 'Timeline' } }: { panelNames?: { right: string; timeline: string } } = {}) {
  const reviewer = useReviewer();
  const panels = usePanelsStore();
  const initials = reviewer.name.trim().split(/\s+/).filter(Boolean).map((w) => w[0]?.toUpperCase()).slice(0, 2).join('');
  return (
    <Popover className="app-you" align="end" ariaLabel={reviewer.name ? `You: ${reviewer.name}` : 'You: name, theme and panels'}
      label={initials ? <span className="app-initials">{initials}</span> : <Icon name="user" />} panelClassName="app-you-panel">
      {() => (
        <div className="app-you-body">
          <span data-reviewer>
            <Field label="Your name, shown on notes you send" value={reviewer.name} onChange={reviewer.setName} placeholder="For example, Maya" />
          </span>
          <div className="app-you-row"><span>Theme</span><ThemeSwitch /></div>
          <div role="group" aria-label="Panels">
            <p className="ui-menu-title">Show</p>
            <MenuItem checked={panels.isOpen('right')} hint={formatKeys(TABLE.toggleRight.keys)} onClick={() => panels.toggle('right')}>{panelNames.right}</MenuItem>
            <MenuItem checked={panels.isOpen('timeline')} hint={formatKeys(TABLE.toggleTimeline.keys)} onClick={() => panels.toggle('timeline')}>{panelNames.timeline}</MenuItem>
          </div>
        </div>
      )}
    </Popover>
  );
}
