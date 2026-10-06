import React, {useState} from 'react';
import {Box, Text} from 'ink';
import TextInput from 'ink-text-input';
import {CanvasClient} from '../api/client.js';
import {setConfig} from '../config/store.js';
import {t} from '../i18n/index.js';

type Step = 'domain' | 'token' | 'validating' | 'success' | 'error';

interface Props {
	onComplete?: () => void;
}

export default function SetupCommand({onComplete}: Props) {
	const [step, setStep] = useState<Step>('domain');
	const [domain, setDomain] = useState('');
	const [token, setToken] = useState('');
	const [userName, setUserName] = useState('');
	const [errorMsg, setErrorMsg] = useState('');
	const strings = t();

	const handleDomainSubmit = (value: string) => {
		let url = value.trim();
		if (!url.startsWith('http')) {
			url = `https://${url}`;
		}

		setDomain(url);
		setStep('token');
	};

	const handleTokenSubmit = async (value: string) => {
		const tokenValue = value.trim();
		setToken(tokenValue);
		setStep('validating');

		const client = new CanvasClient({domain, token: tokenValue});
		const result = await client.validate();

		if (result.valid) {
			setConfig(domain, tokenValue);
			setUserName(result.user?.name ?? 'User');
			setStep('success');
			if (onComplete) {
				setTimeout(onComplete, 2000);
			}
		} else {
			setErrorMsg(result.error ?? strings.common.error);
			setStep('error');
		}
	};

	if (step === 'domain') {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold color="cyan">
					{strings.setup.title}
				</Text>
				<Text> </Text>
				<Text>{strings.setup.domainPrompt}</Text>
				<Text dimColor>{strings.setup.domainExample}</Text>
				<Text> </Text>
				<Box>
					<Text color="cyan">{strings.setup.domainLabel}: </Text>
					<TextInput
						value={domain}
						onChange={setDomain}
						onSubmit={handleDomainSubmit}
						placeholder={strings.setup.domainPlaceholder}
					/>
				</Box>
			</Box>
		);
	}

	if (step === 'token') {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold color="cyan">
					{strings.setup.tokenTitle}
				</Text>
				<Text> </Text>
				<Text>{strings.setup.tokenPrompt}</Text>
				<Text dimColor>
					{strings.setup.domainLabel}: {domain}
				</Text>
				<Text> </Text>
				<Box>
					<Text color="cyan">{strings.setup.tokenLabel}: </Text>
					<TextInput
						value={token}
						onChange={setToken}
						onSubmit={handleTokenSubmit}
					/>
				</Box>
			</Box>
		);
	}

	if (step === 'validating') {
		return (
			<Box padding={1}>
				<Text color="yellow">... </Text>
				<Text>
					{strings.setup.connecting} {domain}...
				</Text>
			</Box>
		);
	}

	if (step === 'success') {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="green" bold>
					{strings.setup.successTitle}
				</Text>
				<Text> </Text>
				<Text>
					{strings.setup.greeting},{' '}
					<Text bold color="green">
						{userName}
					</Text>
					!
				</Text>
				<Text>
					{strings.setup.domainLabel}: {domain}
				</Text>
				<Text dimColor>{strings.setup.domainSaved}</Text>
			</Box>
		);
	}

	if (step === 'error') {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="red" bold>
					{strings.setup.errorTitle}
				</Text>
				<Text color="red">{errorMsg}</Text>
				<Text> </Text>
				<Text dimColor>{strings.setup.errorRetry}</Text>
			</Box>
		);
	}

	return null;
}
