/**
 * Responsive Layout Component
 * Adapts UI for different screen sizes
 */

import { useState, useEffect, createContext, useContext } from 'react';

export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface ResponsiveContextValue {
	breakpoint: Breakpoint;
	isMobile: boolean;
	isTablet: boolean;
	isDesktop: boolean;
	isWide: boolean;
}

const ResponsiveContext = createContext<ResponsiveContextValue>({
	breakpoint: 'lg',
	isMobile: false,
	isTablet: false,
	isDesktop: true,
	isWide: false,
});

export function useResponsive() {
	return useContext(ResponsiveContext);
}

interface ResponsiveProviderProps {
	children: React.ReactNode;
}

const BREAKPOINTS: Record<Breakpoint, number> = {
	sm: 640,
	md: 768,
	lg: 1024,
	xl: 1280,
	'2xl': 1536,
};

export function ResponsiveProvider({ children }: ResponsiveProviderProps) {
	const [breakpoint, setBreakpoint] = useState<Breakpoint>('lg');

	useEffect(() => {
		const updateBreakpoint = () => {
			const width = window.innerWidth;
			
			if (width < BREAKPOINTS.sm) {
				setBreakpoint('sm');
			} else if (width < BREAKPOINTS.md) {
				setBreakpoint('md');
			} else if (width < BREAKPOINTS.lg) {
				setBreakpoint('lg');
			} else if (width < BREAKPOINTS.xl) {
				setBreakpoint('xl');
			} else {
				setBreakpoint('2xl');
			}
		};

		updateBreakpoint();
		window.addEventListener('resize', updateBreakpoint);
		return () => window.removeEventListener('resize', updateBreakpoint);
	}, []);

	const value: ResponsiveContextValue = {
		breakpoint,
		isMobile: breakpoint === 'sm',
		isTablet: breakpoint === 'md',
		isDesktop: ['lg', 'xl', '2xl'].includes(breakpoint),
		isWide: breakpoint === '2xl',
	};

	return (
		<ResponsiveContext.Provider value={value}>
			{children}
		</ResponsiveContext.Provider>
	);
}

// Responsive conditional rendering
interface ShowProps {
	children: React.ReactNode;
	breakpoint?: Breakpoint;
	above?: Breakpoint;
	below?: Breakpoint;
}

export function Show({ children, above, below }: ShowProps) {
	const { breakpoint: current } = useResponsive();
	
	let visible = true;
	
	if (above) {
		const aboveIndex = Object.keys(BREAKPOINTS).indexOf(above);
		const currentIndex = Object.keys(BREAKPOINTS).indexOf(current);
		visible = currentIndex >= aboveIndex;
	}
	
	if (below) {
		const belowIndex = Object.keys(BREAKPOINTS).indexOf(below);
		const currentIndex = Object.keys(BREAKPOINTS).indexOf(current);
		visible = currentIndex <= belowIndex;
	}
	
	if (!visible) return null;
	
	return <>{children}</>;
}

// Hide component (opposite of Show)
export function Hide({ children, breakpoint }: { children: React.ReactNode; breakpoint: Breakpoint }) {
	const { breakpoint: current } = useResponsive();
	
	const hideIndex = Object.keys(BREAKPOINTS).indexOf(breakpoint);
	const currentIndex = Object.keys(BREAKPOINTS).indexOf(current);
	
	if (currentIndex >= hideIndex) return null;
	
	return <>{children}</>;
}

// Container with responsive max-width
interface ContainerProps {
	children: React.ReactNode;
	className?: string;
	fluid?: boolean;
}

export function Container({ children, className = '', fluid }: ContainerProps) {
	const { isWide } = useResponsive();
	
	if (fluid) {
		return <div className={className}>{children}</div>;
	}
	
	const maxWidth = isWide ? 'max-w-7xl' : 'max-w-5xl';
	
	return (
		<div className={`mx-auto px-4 sm:px-6 lg:px-8 ${maxWidth} ${className}`}>
			{children}
		</div>
	);
}

// Responsive flex utilities
export function ResponsiveFlex({
	children,
	direction = 'row',
	gap = 4,
}: {
	children: React.ReactNode;
	direction?: 'row' | 'col';
	gap?: number;
}) {
	const { isMobile, isTablet } = useResponsive();
	
	const flexDirection = isMobile ? 'flex-col' : direction === 'row' ? 'flex-row' : 'flex-col';
	const gapClass = `gap-${gap}`;
	
	return (
		<div className={`flex ${flexDirection} ${gapClass}`}>
			{children}
		</div>
	);
}

// Responsive grid
export function ResponsiveGrid({
	children,
	columns = 3,
}: {
	children: React.ReactNode;
	columns?: number;
}) {
	const { isMobile, isTablet } = useResponsive();
	
	let cols = `grid-cols-${columns}`;
	if (isMobile) {
		cols = 'grid-cols-1';
	} else if (isTablet) {
		cols = 'grid-cols-2';
	}
	
	return (
		<div className={`grid ${cols} gap-4`}>
			{children}
		</div>
	);
}
