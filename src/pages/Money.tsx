import { IonContent, IonPage, IonRefresher, IonRefresherContent } from '@ionic/react';
import { useState } from 'react';
import { useUserId } from '../auth/AuthProvider';
import { Button, Card } from '../components';
import { deleteAccount, deleteRecord, loadMoney, saveAccount, saveRecord, type MoneyAccount } from '../data/money';
import { useLoader } from '../data/useLoader';
import type { MoneyRecordRow } from '../lib/database.types';
import AccountSheet from './money/AccountSheet';
import MoneyView from './money/MoneyView';
import RecordSheet from './money/RecordSheet';
import './Money.css';

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

const Money: React.FC = () => {
  const userId = useUserId();
  const { data, error, loading, reload } = useLoader(loadMoney);
  const [record, setRecord] = useState<MoneyRecordRow | 'new' | null>(null);
  const [account, setAccount] = useState<MoneyAccount | 'new' | null>(null);

  return (
    <IonPage>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => void reload().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        <div className="screen">
          <div>
            <p className="t-cap">{MONTH.format(new Date())}</p>
            <h1 className="t-title-lg">Money</h1>
          </div>
          {!data && loading && (
            <p className="t-cap" role="status">
              Loading money
            </p>
          )}
          {error && (
            <Card role="alert">
              <p className="t-title-sm">Money could not load</p>
              <p className="t-cap">{error}</p>
              <Button style={{ marginTop: 'var(--space-3)' }} onClick={() => void reload()}>
                Try again
              </Button>
            </Card>
          )}
          {data && (
            <MoneyView
              data={data}
              now={new Date()}
              onAddRecord={() => setRecord('new')}
              onEditRecord={setRecord}
              onAddAccount={() => setAccount('new')}
              onEditAccount={setAccount}
            />
          )}
        </div>
        {data && (
          <>
            <RecordSheet
              record={record}
              data={data}
              onDismiss={() => setRecord(null)}
              onSave={async (input, id) => {
                await saveRecord(userId, input, id);
                setRecord(null);
                await reload();
              }}
              onDelete={async (id) => {
                await deleteRecord(id);
                setRecord(null);
                await reload();
              }}
            />
            <AccountSheet
              account={account}
              onDismiss={() => setAccount(null)}
              onSave={async (input, id) => {
                await saveAccount(userId, input, id);
                setAccount(null);
                await reload();
              }}
              onDelete={async (id) => {
                await deleteAccount(id);
                setAccount(null);
                await reload();
              }}
            />
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Money;
