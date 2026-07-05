"use client";

export default function StreamsAIEmptyComposerPositionBridge() {
  return (
    <style jsx global>{`
      @media (min-width: 900px) {
        .shell.desktop main,
        .shell.expanded main,
        .shell.collapsed main {
          height: 100%;
          min-height: 0;
          overflow: hidden;
        }

        .shell.desktop .chatPanel,
        .shell.expanded .chatPanel,
        .shell.collapsed .chatPanel {
          height: 100%;
          min-height: 0;
          display: grid;
          grid-template-rows: minmax(0, 1fr) auto;
          overflow: hidden;
          position: relative;
        }

        .shell.desktop .chatScroll,
        .shell.expanded .chatScroll,
        .shell.collapsed .chatScroll {
          min-height: 0;
          height: auto;
          overflow: auto;
          overflow-y: auto;
          padding-bottom: 28px;
          scroll-padding-bottom: 28px;
        }

        .shell.desktop .composer,
        .shell.expanded .composer,
        .shell.collapsed .composer {
          position: sticky;
          left: auto;
          right: auto;
          top: auto;
          bottom: 24px;
          width: min(1120px, calc(100% - 48px));
          min-width: 0;
          max-width: calc(100% - 48px);
          transform: none;
          margin: 0 auto 24px;
          z-index: 90;
          display: block;
          flex: 0 0 auto;
          flex-shrink: 0;
        }

        .shell.desktop .chatPanel .empty + .composer,
        .shell.expanded .chatPanel .empty + .composer,
        .shell.collapsed .chatPanel .empty + .composer {
          margin-top: 28px;
        }
      }
    `}</style>
  );
}
