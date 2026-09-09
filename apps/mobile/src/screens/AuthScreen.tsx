import { useState } from 'react';
import { Button, Text, TextInput, View } from 'react-native';
import { isValidOtpCode, normalizeBrPhone } from '../lib/phone.js';

/** 21 Auth: entrada de telefone, verificação, recuperação (estados). */
export type AuthStep = 'phone' | 'code';

export function AuthScreen({ onAuthenticated }: { onAuthenticated: (phone: string) => void }) {
  const [step, setStep] = useState<AuthStep>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submitPhone = (): void => {
    const normalized = normalizeBrPhone(phone);
    if (normalized === null) {
      setError('Digite um celular válido com DDD.');
      return;
    }
    setError(null);
    setPhone(normalized);
    setStep('code');
  };

  const submitCode = (): void => {
    if (!isValidOtpCode(code)) {
      setError('Código de 6 dígitos.');
      return;
    }
    setError(null);
    onAuthenticated(phone);
  };

  return (
    <View accessible accessibilityLabel="Autenticação">
      {step === 'phone' ? (
        <View>
          <Text accessibilityRole="header">Entrar com celular</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="(11) 99999-0001"
            accessibilityLabel="Número do celular"
            accessibilityHint="Digite com DDD"
          />
          <Button title="Receber código" onPress={submitPhone} accessibilityLabel="Receber código por SMS" />
        </View>
      ) : (
        <View>
          <Text accessibilityRole="header">Digite o código</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="000000"
            accessibilityLabel="Código de verificação"
          />
          <Button title="Entrar" onPress={submitCode} accessibilityLabel="Confirmar código e entrar" />
        </View>
      )}
      {error !== null ? (
        <Text role="alert" accessibilityLiveRegion="assertive">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
