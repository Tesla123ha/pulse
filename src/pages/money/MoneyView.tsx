import { Button, Card, Icon, ListRow, Stagger, StaggerItem } from '../../components';
import type { MoneyAccount, MoneyData } from '../../data/money';
import { addDays, dateKey, formatShortDate, startOfDay } from '../../lib/dates';
import type { MoneyRecordRow } from '../../lib/database.types';
import { accountKind, categoryIcon, formatPeso, formatRecordAmount } from '../../lib/money';

export interface MoneyViewProps {
  data: MoneyData;
  now: Date;
  onAddRecord: () => void;
  onEditRecord: (r: MoneyRecordRow) => void;
  onAddAccount: () => void;
  onEditAccount: (a: MoneyAccount) => void;
}

function dayLabel(key: string, now: Date) {
  const today = dateKey(now);
  if (key === today) return 'Today';
  if (key === dateKey(addDays(startOfDay(now), -1))) return 'Yesterday';
  const [y, m, d] = key.split('-').map(Number);
  return formatShortDate(new Date(y, m - 1, d));
}

/** Balances, accounts and recent records. Pure: everything comes from props. */
const MoneyView: React.FC<MoneyViewProps> = ({ data, now, onAddRecord, onEditRecord, onAddAccount, onEditAccount }) => {
  const accountName = new Map(data.accounts.map((a) => [a.id, a.name]));
  const category = new Map(data.categories.map((c) => [c.id, c]));

  const groups: { key: string; records: MoneyRecordRow[] }[] = [];
  for (const r of data.recent) {
    const key = dateKey(new Date(r.occurred_at));
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.records.push(r);
    else groups.push({ key, records: [r] });
  }

  if (data.accounts.length === 0) {
    return (
      <Stagger>
        <StaggerItem>
          <Card level="raised" hero xl className="money-empty">
            <h2 className="t-title-md">Add your first account</h2>
            <p className="t-secondary">
              Cash, a bank account, GCash or a card. Add as many as you like and rename them any time.
            </p>
            <Button variant="primary" size="lg" block onClick={onAddAccount}>
              <Icon name="plus" />
              Add account
            </Button>
          </Card>
        </StaggerItem>
      </Stagger>
    );
  }

  return (
    <>
      <Stagger className="split">
        <div className="split__col">
          <StaggerItem>
            <Card level="raised" hero xl className="money-hero">
              <div className="t-cap">Total balance</div>
              <div className="t-display-xl money-total">{formatPeso(data.totalCentavos)}</div>
              <div className="money-month">
                <div className="pl-stat pl-stat--overlay">
                  <div className="pl-stat__label">Spent</div>
                  <div className="money-month__value">{formatPeso(data.monthSpentCentavos)}</div>
                </div>
                <div className="pl-stat pl-stat--overlay">
                  <div className="pl-stat__label">Received</div>
                  <div className="money-month__value">{formatPeso(data.monthIncomeCentavos)}</div>
                </div>
              </div>
              <Button variant="primary" size="lg" block onClick={onAddRecord}>
                <Icon name="plus" />
                Add record
              </Button>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <section className="section" aria-labelledby="accounts-title">
              <div className="sec-head">
                <h2 id="accounts-title" className="t-title-sm">
                  Accounts
                </h2>
                <Button variant="plain" className="money-link" onClick={onAddAccount}>
                  <Icon name="plus" size={20} />
                  Add account
                </Button>
              </div>
              <div className="money-list">
                {data.accounts.map((a) => (
                  <ListRow
                    key={a.id}
                    icon={accountKind(a.kind).icon}
                    title={a.name}
                    caption={accountKind(a.kind).label}
                    end={<span className="t-strong money-amount">{formatPeso(a.balanceCentavos)}</span>}
                    onClick={() => onEditAccount(a)}
                  />
                ))}
              </div>
            </section>
          </StaggerItem>
        </div>
        <div className="split__col">
          <StaggerItem>
            <section className="section" aria-labelledby="records-title">
              <div className="sec-head">
                <h2 id="records-title" className="t-title-sm">
                  Recent records
                </h2>
                <span className="t-cap">Last 90 days</span>
              </div>
              {groups.length === 0 ? (
                <p className="t-cap">No records yet. Add your first expense or income.</p>
              ) : (
                groups.map((g) => (
                  <div key={g.key} className="section money-day">
                    <h3 className="t-cap">{dayLabel(g.key, now)}</h3>
                    <div className="money-list">
                      {g.records.map((r) => {
                        const c = r.category_id ? category.get(r.category_id) : undefined;
                        const where =
                          r.type === 'transfer'
                            ? `${accountName.get(r.account_id) ?? 'Account'} to ${accountName.get(r.to_account_id ?? '') ?? 'account'}`
                            : (accountName.get(r.account_id) ?? 'Account');
                        return (
                          <ListRow
                            key={r.id}
                            icon={r.type === 'transfer' ? 'swap' : categoryIcon(c?.icon ?? 'dots')}
                            title={
                              r.type === 'transfer'
                                ? 'Transfer'
                                : (c?.name ?? (r.type === 'income' ? 'Income' : 'Expense'))
                            }
                            caption={[where, r.note].filter(Boolean).join(' · ')}
                            end={
                              <span className="t-strong money-amount">
                                {formatRecordAmount(r.type, r.amount_centavos)}
                              </span>
                            }
                            onClick={() => onEditRecord(r)}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </section>
          </StaggerItem>
        </div>
      </Stagger>
    </>
  );
};

export default MoneyView;
