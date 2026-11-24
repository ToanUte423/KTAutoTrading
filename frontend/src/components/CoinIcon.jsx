import React from 'react';

/**
 * High-definition official SVG logos for supported crypto assets:
 * - Bitcoin (BTC): Official Bitcoin Orange badge with white tilted double-stroke B
 * - Ethereum (ETH): Official Ethereum blue-purple faceted diamond
 * - Solana (SOL): Official Solana neon cyan-to-purple gradient 3-bar mark
 * - Sui (SUI): Official Sui Network cyan water droplet
 */
export default function CoinIcon({ symbol = 'BTC', size = 16, className = '', style = {} }) {
  const clean = (symbol || 'BTC').replace(/[^a-zA-Z]/g, '').toUpperCase();
  const coin = clean.startsWith('ETH')
    ? 'ETH'
    : clean.startsWith('SOL')
    ? 'SOL'
    : clean.startsWith('SUI')
    ? 'SUI'
    : 'BTC';

  if (coin === 'ETH') {
    return (
      <svg
        viewBox="0 0 256 417"
        width={size}
        height={size}
        preserveAspectRatio="xMidYMid meet"
        className={`coin-svg-icon coin-eth ${className}`}
        style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      >
        <path fill="#627EEA" d="M127.96 0L125.17 9.5V285.17L127.96 287.96L255.92 212.32L127.96 0Z" />
        <path fill="#A3B5F8" d="M127.96 0L0 212.32L127.96 287.96V154.16V0Z" />
        <path fill="#627EEA" d="M127.96 312.19L126.39 314.11V412.31L127.96 416.91L256 236.59L127.96 312.19Z" />
        <path fill="#A3B5F8" d="M127.96 416.91V312.19L0 236.59L127.96 416.91Z" />
        <path fill="#455FC6" d="M127.96 287.96L255.92 212.32L127.96 154.16V287.96Z" />
        <path fill="#7895FF" d="M0 212.32L127.96 287.96V154.16L0 212.32Z" />
      </svg>
    );
  }

  if (coin === 'SOL') {
    return (
      <svg
        viewBox="0 0 398 312"
        width={size}
        height={(size * 312) / 398}
        preserveAspectRatio="xMidYMid meet"
        className={`coin-svg-icon coin-sol ${className}`}
        style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      >
        <defs>
          <linearGradient id="solana-gradient-chip" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00FFA3" />
            <stop offset="100%" stopColor="#DC1FFF" />
          </linearGradient>
        </defs>
        {/* Top bar */}
        <path
          d="M64.6 3.8C67 1.4 70.3 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"
          fill="url(#solana-gradient-chip)"
        />
        {/* Middle bar (reversed) */}
        <path
          d="M333.4 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.8c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"
          fill="url(#solana-gradient-chip)"
        />
        {/* Bottom bar */}
        <path
          d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"
          fill="url(#solana-gradient-chip)"
        />
      </svg>
    );
  }

  if (coin === 'SUI') {
    return (
      <svg
        viewBox="0 0 783 1000"
        width={size}
        height={(size * 1000) / 783}
        preserveAspectRatio="xMidYMid meet"
        className={`coin-svg-icon coin-sui ${className}`}
        style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      >
        <defs>
          <linearGradient id="sui-cyan-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4DA2FF" />
            <stop offset="100%" stopColor="#0077FE" />
          </linearGradient>
        </defs>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M626.027 417.029C666.817 468.244 691.209 533.014 691.209 603.469C691.209 673.925 666.076 740.673 624.214 792.176L620.588 796.626L619.641 790.981C618.817 786.201 617.869 781.34 616.757 776.478C595.785 684.349 527.471 605.365 415.03 541.378C339.095 498.28 295.626 446.448 284.213 387.487C276.838 349.375 282.318 311.098 292.907 278.301C303.496 245.545 319.235 218.063 332.626 201.541L376.383 148.06C384.046 138.666 398.426 138.666 406.09 148.06L626.068 417.029H626.027ZM695.206 363.59L402.01 5.12968C396.407 -1.70989 385.942 -1.70989 380.338 5.12968L87.184 363.59L86.2363 364.784C32.3026 431.738 0 516.821 0 609.444C0 825.138 175.151 1000 391.174 1000C607.198 1000 782.349 825.138 782.349 609.444C782.349 516.821 750.046 431.738 696.112 364.826L695.165 363.631L695.206 363.59ZM157.351 415.876L183.556 383.779L184.339 389.712C184.957 394.409 185.74 399.106 186.646 403.844C203.622 492.883 264.23 567.088 365.546 624.565C453.637 674.708 504.934 732.35 519.684 795.554C525.864 821.924 526.936 847.881 524.258 870.584L524.093 871.985L522.816 872.603C483.055 892.009 438.351 902.927 391.133 902.927C225.459 902.927 91.1394 768.855 91.1394 603.428C91.1394 532.396 115.902 467.172 157.269 415.793L157.351 415.876Z"
          fill="url(#sui-cyan-grad)"
        />
      </svg>
    );
  }

  // Default: Bitcoin (BTC)
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      preserveAspectRatio="xMidYMid meet"
      className={`coin-svg-icon coin-btc ${className}`}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <circle cx="16" cy="16" r="16" fill="#F7931A" />
      <path
        d="M23.189 14.02c.314-2.096-1.283-3.223-3.465-3.975l.708-2.84-1.728-.43-.69 2.765c-.454-.114-.92-.22-1.385-.326l.695-2.783L15.596 6l-.708 2.839c-.376-.086-.746-.17-1.104-.26l.002-.009-2.384-.595-.46 1.846s1.283.294 1.256.312c.7.175.826.638.805 1.006l-.806 3.235c.048.012.11.03.18.057l-.183-.045-1.13 4.532c-.086.212-.303.531-.793.41.018.025-1.256-.314-1.256-.314l-.858 1.978 2.25.561c.418.105.828.215 1.231.318l-.715 2.872 1.727.43.708-2.84c.472.127.93.245 1.378.357l-.705 2.828 1.728.432.715-2.866c2.948.558 5.164.333 6.097-2.333.752-2.146-.037-3.385-1.587-4.192 1.13-.26 1.98-1.003 2.207-2.538zm-3.95 5.538c-.533 2.147-4.148 1.013-5.32.72l.95-3.806c1.172.292 4.929.872 4.37 3.086zm.535-5.568c-.487 1.953-3.495.96-4.47.717l.86-3.45c.975.244 4.118.699 3.61 2.733z"
        fill="#FFFFFF"
      />
    </svg>
  );
}
