'use client';

import React, { useState } from 'react';
import { C } from './tokens';

interface UserSettings {
  theme: 'dark' | 'light' | 'auto';
  fontSize: 'small' | 'normal' | 'large';
  autoScroll: boolean;
  showTimestamps: boolean;
  codeLineNumbers: boolean;
}

interface UserSettingsPanelProps {
  settings?: UserSettings;
  onSave?: (settings: UserSettings) => void;
  onClose?: () => void;
}

export function UserSettingsPanel({ settings, onSave, onClose }: UserSettingsPanelProps) {
  const [localSettings, setLocalSettings] = useState<UserSettings>(
    settings || {
      theme: 'dark',
      fontSize: 'normal',
      autoScroll: true,
      showTimestamps: true,
      codeLineNumbers: true,
    }
  );

  const handleSave = () => {
    onSave?.(localSettings);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 300,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: C.bg2,
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '500px',
          width: '90vw',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontSize: '16px',
            fontWeight: 500,
            color: C.t1,
            margin: '0 0 20px 0',
            lineHeight: 1.4,
          }}
        >
          Settings
        </h2>

        {/* Theme */}
        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 500,
              color: C.t2,
              marginBottom: '8px',
              lineHeight: 1.4,
            }}
          >
            Theme
          </label>
          <select
            value={localSettings.theme}
            onChange={(e) =>
              setLocalSettings({
                ...localSettings,
                theme: e.target.value as 'dark' | 'light' | 'auto',
              })
            }
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: C.bg3,
              color: C.t1,
              border: `1px solid ${C.t4}`,
              borderRadius: '6px',
              fontSize: '12px',
              lineHeight: 1.4,
            }}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="auto">Auto (System)</option>
          </select>
        </div>

        {/* Font Size */}
        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 500,
              color: C.t2,
              marginBottom: '8px',
              lineHeight: 1.4,
            }}
          >
            Font Size
          </label>
          <select
            value={localSettings.fontSize}
            onChange={(e) =>
              setLocalSettings({
                ...localSettings,
                fontSize: e.target.value as 'small' | 'normal' | 'large',
              })
            }
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: C.bg3,
              color: C.t1,
              border: `1px solid ${C.t4}`,
              borderRadius: '6px',
              fontSize: '12px',
              lineHeight: 1.4,
            }}
          >
            <option value="small">Small (11px)</option>
            <option value="normal">Normal (13px)</option>
            <option value="large">Large (15px)</option>
          </select>
        </div>

        {/* Auto Scroll */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={localSettings.autoScroll}
            onChange={(e) =>
              setLocalSettings({
                ...localSettings,
                autoScroll: e.target.checked,
              })
            }
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontSize: '12px', color: C.t2, lineHeight: 1.4 }}>
            Auto-scroll to latest message
          </span>
        </label>

        {/* Show Timestamps */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={localSettings.showTimestamps}
            onChange={(e) =>
              setLocalSettings({
                ...localSettings,
                showTimestamps: e.target.checked,
              })
            }
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontSize: '12px', color: C.t2, lineHeight: 1.4 }}>
            Show message timestamps
          </span>
        </label>

        {/* Code Line Numbers */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '20px',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={localSettings.codeLineNumbers}
            onChange={(e) =>
              setLocalSettings({
                ...localSettings,
                codeLineNumbers: e.target.checked,
              })
            }
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontSize: '12px', color: C.t2, lineHeight: 1.4 }}>
            Show line numbers in code
          </span>
        </label>

        {/* Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 12px',
              backgroundColor: C.bg3,
              color: C.t1,
              border: `1px solid ${C.t4}`,
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              lineHeight: 1.4,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '8px 12px',
              backgroundColor: C.acc,
              color: C.bg,
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
              lineHeight: 1.4,
            }}
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

export default UserSettingsPanel;
