import { useState, useCallback, useEffect, RefObject } from 'react';

interface UseScrollControlProps {
  containerRef: RefObject<HTMLDivElement>;
  isPlaying: boolean;
  currentTime: number;
  basePixelsPerBeat: number;
}

interface UseScrollControlReturn {
  scrollOffset: number;
  isDragging: boolean;
  isManualScrolling: boolean;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchMove: (e: React.TouchEvent) => void;
  handleTouchEnd: () => void;
  handleResumeAutoScroll: () => void;
}

export const useScrollControl = ({
  containerRef,
  isPlaying,
  currentTime,
  basePixelsPerBeat
}: UseScrollControlProps): UseScrollControlReturn => {
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isManualScrolling, setIsManualScrolling] = useState(false);

  // Initialize position
  useEffect(() => {
    const initializePosition = () => {
      if (containerRef.current) {
        const triggerLinePosition = containerRef.current.clientWidth / 2;
        setScrollOffset(triggerLinePosition);
      }
    };

    // Initial setup
    initializePosition();

    // Add a small delay to ensure the container is properly rendered
    const timeoutId = setTimeout(initializePosition, 100);

    return () => clearTimeout(timeoutId);
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && !isManualScrolling && !isPlaying) {
        const containerWidth = containerRef.current.clientWidth;
        setScrollOffset(containerWidth / 2);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isManualScrolling, isPlaying]);

  // Auto-scroll during playback
  useEffect(() => {
    if (isPlaying && currentTime > 0 && containerRef.current && !isManualScrolling) {
      const containerWidth = containerRef.current.clientWidth;
      const newOffset = containerWidth / 2 - (currentTime * basePixelsPerBeat);
      
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        setScrollOffset(newOffset);
      });
    }
  }, [isPlaying, currentTime, basePixelsPerBeat, isManualScrolling]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.clientX - scrollOffset);
    setIsManualScrolling(true);
  }, [scrollOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const newOffset = e.clientX - startX;
    setScrollOffset(newOffset);
  }, [isDragging, startX]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX - scrollOffset);
    setIsManualScrolling(true);
  }, [scrollOffset]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const newOffset = e.touches[0].clientX - startX;
    setScrollOffset(newOffset);
  }, [isDragging, startX]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleResumeAutoScroll = useCallback(() => {
    setIsManualScrolling(false);
    if (containerRef.current && isPlaying) {
      const containerWidth = containerRef.current.clientWidth;
      setScrollOffset(containerWidth / 2 - (currentTime * basePixelsPerBeat));
    }
  }, [isPlaying, currentTime, basePixelsPerBeat]);

  return {
    scrollOffset,
    isDragging,
    isManualScrolling,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleResumeAutoScroll
  };
}; 