// @ts-nocheck
import React from 'react';

interface TitleBarProps {
  folderPath: string | null;
  onOpenFolder: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ folderPath, onOpenFolder }) => {
  const projectName = folderPath ? folderPath.split('/').pop() : 'Kimi IDE';
  
  return (
    <div style={styles.container}>
      <div style={styles.left}>
        <div style={styles.windowControls}>
          <button style={{...styles.button, backgroundColor: '#ff5f56'}} />
          <button style={{...styles.button, backgroundColor: '#ffbd2e'}} />
          <button style={{...styles.button, backgroundColor: '#27c93f'}} />
        </div>
      </div>
      
      <div style={styles.center}>
        <span style={styles.projectName}>{projectName}</span>
      </div>
      
      <div style={styles.right}>
        {!folderPath && (
          <button style={styles.openButton} onClick={onOpenFolder}>
            Open Folder
          </button>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '38px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 12px',
    backgroundColor: '#2d2d30',
    borderBottom: '1px solid #1e1e1e',
    WebkitAppRegion: 'drag',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    WebkitAppRegion: 'no-drag',
  },
  windowControls: {
    display: 'flex',
    gap: '8px',
  },
  button: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
  },
  center: {
    flex: 1,
    textAlign: 'center',
  },
  projectName: {
    color: '#cccccc',
    fontSize: '13px',
    fontWeight: 500,
  },
  right: {
    WebkitAppRegion: 'no-drag',
  },
  openButton: {
    padding: '4px 12px',
    backgroundColor: '#0e639c',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
};
// @ts-nocheck
