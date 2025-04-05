import React from 'react';

interface LoopPointAdjusterProps {
  onAdjust: (direction: 'left' | 'right', amount: 'measure' | 'beat') => void;
}

const LoopPointAdjuster: React.FC<LoopPointAdjusterProps> = ({ onAdjust }) => {
  return (
    <div className="loop-point-adjuster">
      <div className="adjustment-group">
        <button 
          className="adjustment-button" 
          onClick={() => onAdjust('left', 'measure')}
          title="Move one measure left"
        >
          ⏪
        </button>
        <button 
          className="adjustment-button" 
          onClick={() => onAdjust('left', 'beat')}
          title="Move one beat left"
        >
          ◀
        </button>
        <button 
          className="adjustment-button" 
          onClick={() => onAdjust('right', 'beat')}
          title="Move one beat right"
        >
          ▶
        </button>
        <button 
          className="adjustment-button" 
          onClick={() => onAdjust('right', 'measure')}
          title="Move one measure right"
        >
          ⏩
        </button>
      </div>
    </div>
  );
};

export default LoopPointAdjuster; 