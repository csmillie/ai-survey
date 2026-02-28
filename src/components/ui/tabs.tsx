"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  activeTab: string;
  onTabChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue>({
  activeTab: "",
  onTabChange: () => {},
});

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

function Tabs({
  defaultValue = "",
  value,
  onValueChange,
  className,
  children,
  ...props
}: TabsProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);

  const isControlled = value !== undefined;
  const activeTab = isControlled ? value : internalValue;

  const onTabChange = React.useCallback(
    (newValue: string) => {
      if (isControlled) {
        onValueChange?.(newValue);
      } else {
        setInternalValue(newValue);
        onValueChange?.(newValue);
      }
    },
    [isControlled, onValueChange]
  );

  return (
    <TabsContext.Provider value={{ activeTab, onTabChange }}>
      <div className={cn(className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {}

const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md bg-[hsl(var(--muted))] p-1 text-[hsl(var(--muted-foreground))]",
        className
      )}
      {...props}
    />
  )
);
TabsList.displayName = "TabsList";

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, ...props }, ref) => {
    const { activeTab, onTabChange } = React.useContext(TabsContext);
    const isActive = activeTab === value;

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-[hsl(var(--background))] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          isActive &&
            "bg-[hsl(var(--background))] text-[hsl(var(--foreground))] shadow-sm",
          className
        )}
        onClick={() => onTabChange(value)}
        {...props}
      />
    );
  }
);
TabsTrigger.displayName = "TabsTrigger";

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, ...props }, ref) => {
    const { activeTab } = React.useContext(TabsContext);

    if (activeTab !== value) return null;

    return (
      <div
        ref={ref}
        className={cn(
          "mt-2 ring-offset-[hsl(var(--background))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2",
          className
        )}
        {...props}
      />
    );
  }
);
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
