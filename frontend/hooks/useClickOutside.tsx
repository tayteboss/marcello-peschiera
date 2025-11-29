import React, { useEffect } from 'react';

export const useClickOutside = <T extends HTMLElement = HTMLElement>(
	ref: React.MutableRefObject<HTMLElement>,
	handler: (event: MouseEvent | TouchEvent) => void,
	excludeRefs?: React.RefObject<T | null>[]
) => {
	useEffect(() => {
		const listener = (event: MouseEvent | TouchEvent) => {
			
			if (!ref.current || ref.current.contains(event.target as Node)) {
				return;
			}

			// Check if click is within any excluded refs
			if (excludeRefs) {
				for (const excludeRef of excludeRefs) {
					if (excludeRef.current && excludeRef.current.contains(event.target as Node)) {
						return;
					}
				}
			}

			handler(event);
		};
		document.addEventListener('mousedown', listener);
		document.addEventListener('touchstart', listener);
		
		return () => {
			document.removeEventListener('mousedown', listener);
			document.removeEventListener('touchstart', listener);
		}

	}, [handler, ref, excludeRefs]);

};

// HOW TO USE

// const ref = useRef<HTMLDivElement>(null!);
// useClickOutside(ref, () => {
// 	setIsActive(false);
// });
