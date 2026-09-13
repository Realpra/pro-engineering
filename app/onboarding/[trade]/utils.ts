export function tradeName(trade: string): string {
  const map: Record<string, string> = {
    mason:'Mason', plumber:'Plumber', electrician:'Electrician',
    waterproofer:'Waterproofer', painter:'Painter', carpenter:'Carpenter',
    'false-ceiling-installer':'False Ceiling Installer', helper:'Helper', supervisor:'Supervisor',
  }
  return map[trade.toLowerCase()] ?? trade
}
