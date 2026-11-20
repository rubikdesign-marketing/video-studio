import type { ComponentProps } from 'react';
import { cx } from './cx';

export type ButtonVariant = 'default' | 'primary' | 'quiet';
export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
}

export function Button({ variant = 'default', type = 'button', className, ...rest }: ButtonProps) {
  return <button type={type} className={cx('ui-button', `ui-button--${variant}`, className)} {...rest} />;
}
