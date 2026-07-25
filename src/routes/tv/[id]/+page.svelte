<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import QRCode from 'qrcode';

	let pollId = $derived(page.params.id);

	let pollData: any = $state(null);
	let qrDataUrl = $state('');
	let guestVoteUrl = $state('');
	let loading = $state(true);
	let errorMsg = $state('');
	let recentVoterNotification = $state('');
	let eventSource: EventSource | null = null;
	let autoPlayInterval: NodeJS.Timeout | null = null;
	let isAutoPlaying = $state(false);

	onMount(async () => {
		await loadPollData();
		await generateQrCode();
		connectSseStream();
	});

	onDestroy(() => {
		if (eventSource) eventSource.close();
		if (autoPlayInterval) clearInterval(autoPlayInterval);
	});

	async function loadPollData() {
		try {
			const res = await fetch(`/api/polls/${pollId}`);
			const data = await res.json();
			if (res.ok) {
				pollData = data;
			} else {
				errorMsg = data.error || 'Failed to load poll';
			}
		} catch (e: any) {
			errorMsg = e.message;
		} finally {
			loading = false;
		}
	}

	async function generateQrCode() {
		try {
			let origin = window.location.origin;

			try {
				const ipRes = await fetch('/api/network-ip');
				const ipData = await ipRes.json();

				if (ipData.origin) {
					// If server returns explicit PUBLIC_ORIGIN or non-docker host IP, use it
					if (!ipData.origin.includes('localhost') && !ipData.origin.includes('127.0.0.1')) {
						origin = ipData.origin;
					}
				}
			} catch (e) {
				// Fallback to window.location.origin
			}

			// Final fallback: if browser is on 192.168.x.x, preserve it
			if (window.location.origin && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1')) {
				origin = window.location.origin;
			}

			guestVoteUrl = `${origin}/vote/${pollId}`;
			qrDataUrl = await QRCode.toDataURL(guestVoteUrl, {
				width: 320,
				margin: 1,
				color: {
					dark: '#ffffff',
					light: '#111116'
				}
			});
		} catch (e) {
			console.error('QR code generation failed:', e);
		}
	}

	function connectSseStream() {
		eventSource = new EventSource(`/api/polls/${pollId}/stream`);

		eventSource.addEventListener('vote_submitted', (e: any) => {
			const data = JSON.parse(e.data);
			recentVoterNotification = `BALLOT RECEIVED // ${data.voterNickname.toUpperCase()}`;
			loadPollData();

			setTimeout(() => {
				recentVoterNotification = '';
			}, 4000);
		});

		eventSource.addEventListener('status_changed', () => loadPollData());
		eventSource.addEventListener('presentation_step_changed', () => loadPollData());
		eventSource.addEventListener('poll_updated', () => loadPollData());
	}

	function toggleAutoPlay() {
		if (isAutoPlaying) {
			if (autoPlayInterval) clearInterval(autoPlayInterval);
			isAutoPlaying = false;
		} else {
			isAutoPlaying = true;
			advanceStep();
			autoPlayInterval = setInterval(() => {
				advanceStep();
			}, 7000);
		}
	}

	async function advanceStep() {
		if (!pollData) return;
		const total = pollData.categories.length;
		let nextStep = (pollData.poll.currentRevealStep || 0) + 1;
		if (nextStep > total) nextStep = 1;

		try {
			await fetch(`/api/polls/${pollId}/reveal`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ step: nextStep })
			});
		} catch (e) {
			console.error('Auto-play advance failed:', e);
		}
	}
</script>

<svelte:head>
	<title>{pollData?.poll?.title || 'Party Vote'} | Presentation Display</title>
</svelte:head>

<div class="tv-fullwidth-container">
	{#if loading}
		<div class="center-state">
			<div class="panel-tag">[ SYSTEM INITIALIZATION ]</div>
			<h2>LOADING DISPLAY...</h2>
		</div>
	{:else if errorMsg}
		<div class="center-state">
			<div class="panel-tag">[ ERROR ]</div>
			<h2>{errorMsg}</h2>
		</div>
	{:else if pollData}
		{@const poll = pollData.poll}
		{@const categories = pollData.categories}
		{@const revealStep = poll.currentRevealStep || 0}
		{@const isClosed = poll.status === 'closed'}

		<!-- Compact Subtle TV Header (Giving priority to content) -->
		<header class="empire-panel tv-compact-header">
			<div class="header-left">
				<span class="page-title-subtle">[ SYSTEM TERMINAL // TV DISPLAY ]</span>
				<h2 class="poll-title-compact">{poll.title}</h2>
			</div>

			<div class="header-right">
				<div class="ballot-counter">
					<span class="num">{pollData.totalVoterCount}</span>
					<span class="lbl">BALLOTS</span>
				</div>
				<span class="badge {isClosed ? 'badge-closed' : 'badge-active'}">
					{isClosed ? 'WINNERS CEREMONY' : 'VOTING ACTIVE'}
				</span>
			</div>
		</header>

		{#if recentVoterNotification}
			<div class="toast-notification">
				{recentVoterNotification}
			</div>
		{/if}

		{#if !isClosed}
			<!-- ACTIVE VOTING: Proportional Full Width Split (40% QR / 60% Voters) -->
			<main class="widescreen-voting-grid">
				<!-- QR Code Column (~40% width) -->
				<section class="empire-panel qr-col">
					<div class="panel-tag">[ SCAN QR CODE TO VOTE ]</div>
					<div class="space-v"></div>

					{#if qrDataUrl}
						<div class="qr-box">
							<img src={qrDataUrl} alt="Scan QR Code" />
						</div>
					{/if}
					<div class="space-v"></div>
					<div class="url-text">{guestVoteUrl}</div>
				</section>

				<!-- Confirmed Voters Column (~60% width) -->
				<section class="empire-panel voters-col">
					<div class="panel-tag">[ CONFIRMED GUEST BALLOTS // TOTAL: {pollData.voters.length} ]</div>
					<div class="space-v"></div>

					{#if pollData.voters.length === 0}
						<p class="muted-text">Waiting for guests to scan QR code and submit initial ballot...</p>
					{:else}
						<div class="voter-cards-grid">
							{#each pollData.voters as voter}
								<div class="voter-large-chip">
									{voter.nickname}
								</div>
							{/each}
						</div>
					{/if}
				</section>
			</main>
		{:else}
			<!-- CEREMONY MODE: Focused Single Category Screen -->
			<main class="ceremony-container">
				<div class="ceremony-top-bar">
					<button class="btn {isAutoPlaying ? 'btn-danger' : 'btn-primary'}" onclick={toggleAutoPlay}>
						{isAutoPlaying ? 'PAUSE AUTO-PLAY' : 'START AUTO-PLAY CEREMONY'}
					</button>
				</div>

				{#if revealStep === 0}
					<section class="empire-panel ceremony-hero">
						<div class="panel-tag">[ VOTING CLOSED ]</div>
						<h2>PRESENTATION CEREMONY READY</h2>
						<p class="muted-text">Use host admin or click Auto-Play to reveal category winners one by one.</p>
					</section>
				{:else}
					{@const currentCatIdx = revealStep - 1}
					{@const catItem = categories[currentCatIdx]}
					{@const finalWinner = pollData.eventWinners?.categoryWinners?.find(
						(cw: any) => cw.categoryId === catItem?.category?.id
					)}

					{#if catItem}
						{@const cat = catItem.category}
						{@const result = catItem.result}

						<section class="empire-panel ceremony-hero">
							<div class="ceremony-meta">
								<div class="panel-tag">[ CATEGORY {revealStep} OF {categories.length} ]</div>
								<span class="badge badge-strategy">{cat.votingStrategy}</span>
							</div>

							<h1 class="cat-title">{cat.title}</h1>
							<div class="space-v"></div>

							<!-- Winner Display -->
							<div class="winner-box">
								<div class="panel-tag">[ OFFICIAL WINNER ]</div>
								<h1 class="winner-name">
									{finalWinner?.winningOption?.title || 'No Winner Declared'}
								</h1>
								{#if finalWinner?.isRunnerUpFallback}
									<p class="rule-note">Awarded via Single-Win Limit Rule (Runner-Up)</p>
								{:else}
									<p class="result-note">{result.summaryMessage}</p>
								{/if}
							</div>

							<div class="space-v"></div>

							<!-- Standings Bar Graph -->
							<div class="standings-box">
								<div class="panel-tag">[ CATEGORY STANDINGS ]</div>
								<div class="space-v"></div>

								<div class="bars-list">
									{#each result.rankings as r, rIdx}
										<div class="bar-item">
											<div class="bar-info">
												<span class="rank">#{rIdx + 1} {r.title}</span>
												<span class="tally">{r.votes} votes ({r.percentage}%)</span>
											</div>
											<div class="bar-track">
												<div
													class="bar-fill {rIdx === 0 ? 'bar-winner' : ''}"
													style="width: {Math.max(r.percentage, 4)}%;"
												></div>
											</div>
										</div>
									{/each}
								</div>
							</div>
						</section>
					{/if}
				{/if}
			</main>
		{/if}
	{/if}
</div>

<style>
	/* Full-Width TV Layout (No center clamp constraint) */
	.tv-fullwidth-container {
		width: 100%;
		padding: 16px 24px;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.tv-compact-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px 32px;
		margin-bottom: 0;
	}

	.header-left {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.poll-title-compact {
		font-size: 1.6rem;
		margin: 0;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 24px;
	}

	.ballot-counter {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
	}

	.ballot-counter .num {
		font-family: var(--font-mono);
		font-size: 1.8rem;
		font-weight: 800;
		color: var(--accent-cyan);
		line-height: 1;
	}

	.ballot-counter .lbl {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--text-secondary);
	}

	.toast-notification {
		position: fixed;
		bottom: 32px;
		right: 32px;
		padding: 16px 28px;
		background: var(--accent-cyan);
		color: #000000;
		font-family: var(--font-mono);
		font-weight: 800;
		font-size: 1.1rem;
		border: 2px solid #ffffff;
		box-shadow: var(--shadow-brutal-white);
		z-index: 99;
	}

	/* Proportional Widescreen Split Grid: 40% QR / 60% Voters */
	.widescreen-voting-grid {
		display: grid;
		grid-template-columns: 38% 60%;
		gap: 2%;
		width: 100%;
	}

	@media (max-width: 960px) {
		.widescreen-voting-grid {
			grid-template-columns: 1fr;
		}
	}

	.qr-col {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 32px;
	}

	.qr-box {
		padding: 16px;
		background: var(--bg-panel-elevated);
		border: var(--border-stark);
	}

	.qr-box img {
		display: block;
		width: 280px;
		height: 280px;
	}

	.url-text {
		font-family: var(--font-mono);
		font-size: 1rem;
		color: var(--accent-cyan);
		background: var(--bg-panel-elevated);
		padding: 10px 20px;
		border: 1px solid var(--accent-cyan);
		word-break: break-all;
	}

	.voters-col {
		padding: 32px;
		display: flex;
		flex-direction: column;
	}

	.voter-cards-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 14px;
	}

	.voter-large-chip {
		padding: 14px 24px;
		background: var(--bg-panel-elevated);
		border: var(--border-subtle);
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: 1.2rem;
		color: var(--text-primary);
	}

	.ceremony-container {
		display: flex;
		flex-direction: column;
		gap: 20px;
		width: 100%;
	}

	.ceremony-top-bar {
		display: flex;
		justify-content: flex-end;
	}

	.ceremony-hero {
		padding: 48px;
		display: flex;
		flex-direction: column;
	}

	.ceremony-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	.cat-title {
		font-size: 2.8rem;
	}

	.winner-box {
		padding: 36px;
		background: var(--bg-panel-elevated);
		border-left: 6px solid var(--accent-cyan);
		border-top: var(--border-subtle);
		border-right: var(--border-subtle);
		border-bottom: var(--border-subtle);
		margin-bottom: 24px;
	}

	.winner-name {
		font-size: 3.2rem;
		color: var(--text-primary);
		margin: 8px 0;
	}

	.rule-note {
		color: var(--accent-cyan);
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: 0.95rem;
	}

	.result-note {
		color: var(--text-secondary);
		font-size: 1.05rem;
	}

	.standings-box {
		background: var(--bg-panel-elevated);
		padding: 32px;
		border: var(--border-subtle);
	}

	.bars-list {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.bar-item {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.bar-info {
		display: flex;
		justify-content: space-between;
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: 1.1rem;
	}

	.bar-track {
		width: 100%;
		height: 28px;
		background: var(--bg-space);
		border: 1px solid var(--text-secondary);
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		background: var(--text-secondary);
		transition: width 0.5s ease;
	}

	.bar-winner {
		background: var(--accent-cyan);
	}

	.center-state {
		margin: auto;
		text-align: center;
		padding: 80px 24px;
	}

	.muted-text { color: var(--text-dim); font-size: 1rem; }
</style>
