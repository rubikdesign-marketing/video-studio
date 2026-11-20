import { Segmented } from '../ui';
import { useTheme, type ThemeName } from './theme';

const options: { value: ThemeName; label: string }[] = [
  { value: 'night', label: 'Night' },
  { value: 'paper', label: 'Paper' },
];

/** Night or Paper. The choice is remembered in this browser. */
export function ThemeSwitch() {
  const theme = useTheme((state) => state.theme);
  const setTheme = useTheme((state) => state.setTheme);
  return <Segmented label="Theme" options={options} value={theme} onChange={setTheme} />;
}
