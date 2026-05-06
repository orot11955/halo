import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost';
  size?: 'md' | 'sm';
}

export function Button({
  variant = 'default',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        styles.btn,
        variant === 'primary' && styles.primary,
        variant === 'ghost' && styles.ghost,
        size === 'sm' && styles.sm,
        className,
      )}
      {...rest}
    />
  );
}
