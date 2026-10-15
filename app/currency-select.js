import { CURRENCIES } from "../lib/currency.js";

export default function CurrencySelect(props) {
  return (
    <select {...props}>
      {CURRENCIES.map(([code, name]) => <option key={code} value={code}>{code} - {name}</option>)}
    </select>
  );
}
