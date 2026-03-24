import type { PortfolioPosition } from '../types';

interface PortfolioTableProps {
  positions: PortfolioPosition[];
}

function formatNumber(value: number): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PortfolioTable({ positions }: PortfolioTableProps) {
  if (positions.length === 0) {
    return <p className="empty-message">Keine Positionen vorhanden</p>;
  }

  return (
    <div className="table-wrapper">
      <table className="portfolio-table">
        <thead>
          <tr>
            <th>ISIN</th>
            <th>Name</th>
            <th className="text-right">St&uuml;ck</th>
            <th className="text-right">Kaufpreis</th>
            <th>W&auml;hrung</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => (
            <tr key={pos.id}>
              <td className="mono">{pos.isin ?? '\u2014'}</td>
              <td>{pos.name}</td>
              <td className="text-right">{formatNumber(pos.quantity)}</td>
              <td className="text-right">{formatNumber(pos.purchase_price)}</td>
              <td>{pos.currency}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
