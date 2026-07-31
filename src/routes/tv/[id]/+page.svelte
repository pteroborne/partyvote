<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import QRCode from 'qrcode';
	import TvBackgroundCanvas from '$lib/components/TvBackgroundCanvas.svelte';
	import { playTransitionSound, playStepSound, playHoverSound, playTapSound } from '$lib/audio';

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
	let isFxEnabled = $state(true);
	let isSoundEnabled = $state(true);
	let clockTime = $state('');
	let clockInterval: NodeJS.Timeout | null = null;
	let revealFlash = $state(false);

	let activeWipe = $state<string | null>(null);
	let revealPhase = $state<1 | 2 | 3>(1); // 1 = Category, 2 = Winner, 3 = Voting Info
	let phaseTimers: NodeJS.Timeout[] = [];

	let prevRevealStep = $state(0);

	const wipeTypes = ['shutter', 'cyber-grid', 'aperture', 'slant-slash', 'holo-scan'];

	onMount(async () => {
		updateClock();
		clockInterval = setInterval(updateClock, 1000);
		await loadPollData();
		await generateQrCode();
		connectSseStream();
	});

	onDestroy(() => {
		if (eventSource) eventSource.close();
		if (autoPlayInterval) clearInterval(autoPlayInterval);
		if (clockInterval) clearInterval(clockInterval);
		clearPhaseTimers();
	});

	function clearPhaseTimers() {
		phaseTimers.forEach(t => clearTimeout(t));
		phaseTimers = [];
	}

	function updateClock() {
		const now = new Date();
		clockTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}

	async function loadPollData() {
		try {
			const res = await fetch(`/api/polls/${pollId}`);
			const data = await res.json();
			if (res.ok) {
				const currentStep = data.poll.currentRevealStep || 0;
				if (currentStep !== prevRevealStep && currentStep > 0 && data.poll.status === 'closed') {
					start3PartRevealSequence(currentStep);
				}
				prevRevealStep = currentStep;
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

	/** 3-Part Sequential Category Reveal Sequence */
	function start3PartRevealSequence(step: number) {
		clearPhaseTimers();

		// Part 1 (0s): Show Category Title prominently
		revealPhase = 1;

		// Part 2 (+1.4s): Trigger Winner Reveal with Wipe Transition & Paired Bassy Audio
		const timer1 = setTimeout(() => {
			const wipeName = wipeTypes[(step - 1) % wipeTypes.length];
			activeWipe = wipeName;

			if (isSoundEnabled) {
				playTransitionSound(wipeName); // Plays paired bassy sci-fi sound!
			}

			revealFlash = true;
			revealPhase = 2; // Winner Card revealed!

			setTimeout(() => (revealFlash = false), 500);
			setTimeout(() => (activeWipe = null), 750);
		}, 1400);

		// Part 3 (+3.2s): Fade in Category Voting Standings Info below
		const timer2 = setTimeout(() => {
			revealPhase = 3;
		}, 3200);

		phaseTimers.push(timer1, timer2);
	}

	async function generateQrCode() {
		try {
			let origin = '';
			if (typeof window !== 'undefined' && window.location?.origin) {
				origin = window.location.origin;
			}

			if (!origin) {
				try {
					const ipRes = await fetch('/api/network-ip');
					const ipData = await ipRes.json();
					if (ipData?.origin) {
						origin = ipData.origin;
					}
				} catch (e) {
					console.error('[PartyVote QR Debug] Failed to fetch /api/network-ip:', e);
				}
			}

			guestVoteUrl = `${origin}/vote/${pollId}`;

			qrDataUrl = await QRCode.toDataURL(guestVoteUrl, {
				width: 340,
				margin: 1,
				color: {
					dark: '#ffffff',
					light: '#111116'
				}
			});
		} catch (e) {
			console.error('[PartyVote QR Debug] QR code generation error:', e);
		}
	}

	function connectSseStream() {
		eventSource = new EventSource(`/api/polls/${pollId}/stream`);

		eventSource.addEventListener('vote_submitted', (e: any) => {
			const data = JSON.parse(e.data);
			recentVoterNotification = `BALLOT RECEIVED // ${data.voterNickname.toUpperCase()}`;
			if (isSoundEnabled) playStepSound();
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
		playTapSound();
		if (isAutoPlaying) {
			if (autoPlayInterval) clearInterval(autoPlayInterval);
			isAutoPlaying = false;
		} else {
			isAutoPlaying = true;
			advanceStep();
			autoPlayInterval = setInterval(() => {
				advanceStep();
			}, 9000); // 9 second pacing for 3-part reveal
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

<TvBackgroundCanvas enabled={isFxEnabled} speedMultiplier={pollData?.poll?.status === 'closed' ? 1.8 : 1.0} />

{#if activeWipe}
	<div class="wipe-{activeWipe}-active"></div>
{/if}

{#if revealFlash}
	<div class="reveal-flash-overlay"></div>
{/if}

<div class="tv-fullwidth-container">
	{#if loading}
		<div class="center-state empire-panel">
			<div class="panel-tag">[ SYSTEM INITIALIZATION ]</div>
			<h2>LOADING PRESENTATION DISPLAY...</h2>
		</div>
	{:else if errorMsg}
		<div class="center-state empire-panel">
			<div class="panel-tag">[ ERROR ]</div>
			<h2>{errorMsg}</h2>
		</div>
	{:else if pollData}
		{@const poll = pollData.poll}
		{@const categories = pollData.categories}
		{@const revealStep = poll.currentRevealStep || 0}
		{@const isClosed = poll.status === 'closed'}

		<!-- TV Compact Header (Subtle so category & winner take center stage) -->
		<header class="empire-panel tv-compact-header">
			<div class="header-left">
				<div class="page-title-subtle">
					<span class="pulse-dot"></span>
					[ LIVE BROADCAST TERMINAL ]
				</div>
				<h2 class="poll-title-compact">{poll.title}</h2>
			</div>

			<div class="header-right">
				<span class="clock-display">{clockTime}</span>

				<button
					class="btn btn-sm btn-ghost"
					onclick={() => { playTapSound(); isSoundEnabled = !isSoundEnabled; }}
					onmouseenter={playHoverSound}
				>
					AUDIO: {isSoundEnabled ? 'ON' : 'OFF'}
				</button>

				<button
					class="btn btn-sm btn-ghost"
					onclick={() => { playTapSound(); isFxEnabled = !isFxEnabled; }}
					onmouseenter={playHoverSound}
				>
					CANVAS: {isFxEnabled ? 'ON' : 'OFF'}
				</button>

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
			<!-- ACTIVE VOTING VIEW -->
			<main class="widescreen-voting-grid">
				<!-- QR Code Column -->
				<section class="empire-panel qr-col">
					<div class="panel-tag">[ SCAN QR CODE WITH MOBILE PHONE ]</div>
					<div class="space-v"></div>

					{#if qrDataUrl}
						<div class="qr-box">
							<img src={qrDataUrl} alt="Scan QR Code" />
						</div>
					{/if}

					<div class="space-v"></div>
					<div class="url-text">{guestVoteUrl}</div>
				</section>

				<!-- Confirmed Voters Column -->
				<section class="empire-panel voters-col">
					<div class="panel-tag">[ CONFIRMED GUEST BALLOTS // TOTAL: {pollData.voters.length} ]</div>
					<div class="space-v"></div>

					{#if pollData.voters.length === 0}
						<div class="empty-voters-state">
							<p class="muted-text">Waiting for guests to scan QR code and submit their ballots...</p>
						</div>
					{:else}
						<div class="voter-cards-grid">
							{#each pollData.voters as voter}
								<div class="voter-large-chip">
									<span class="voter-dot"></span>
									{voter.nickname}
								</div>
							{/each}
						</div>
					{/if}
				</section>
			</main>
		{:else}
			<!-- CEREMONY MODE: 3-PART SEQUENTIAL CATEGORY REVEAL -->
			<main class="ceremony-container">
				<div class="ceremony-top-bar">
					<button
						class="btn {isAutoPlaying ? 'btn-danger' : 'btn-gold'}"
						onclick={toggleAutoPlay}
						onmouseenter={playHoverSound}
					>
						{isAutoPlaying ? '⏸ PAUSE CEREMONY' : '▶ START AUTOMATED CEREMONY'}
					</button>
				</div>

				{#if revealStep === 0}
					<section class="empire-panel ceremony-hero">
						<div class="panel-tag">[ VOTING CLOSED ]</div>
						<h2>PRESENTATION CEREMONY READY</h2>
						<p class="muted-text">Use host admin or click Automated Ceremony to reveal category winners one by one.</p>
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
							<!-- PART 1: CATEGORY TITLE & STRATEGY (ALWAYS VISIBLE AT STEP START) -->
							<div class="category-header-stage">
								<div class="ceremony-meta">
									<div class="panel-tag">[ CATEGORY {revealStep} OF {categories.length} ]</div>
									<span class="badge badge-strategy">{cat.votingStrategy}</span>
								</div>

								<h1 class="cat-title-epic">{cat.title}</h1>
							</div>

							<div class="space-v-lg"></div>

							<!-- PART 2: WINNER CARD (REVEALS IN PHASE 2 WITH WIPE & BASSY SYNTH) -->
							{#if revealPhase >= 2}
								<div class="winner-box-hero winner-enter-animated">
									<div class="winner-header-tag">
										<span class="trophy-icon">🏆</span>
										<span class="panel-tag">[ OFFICIAL WINNER ]</span>
									</div>
									<h1 class="winner-name-epic">
										{finalWinner?.winningOption?.title || 'No Winner Declared'}
									</h1>
									{#if finalWinner?.isRunnerUpFallback}
										<p class="rule-note">Awarded via Single-Win Limit Rule (Runner-Up)</p>
									{:else}
										<p class="result-note">{result.summaryMessage}</p>
									{/if}
								</div>
							{:else}
								<div class="winner-placeholder-card">
									<span class="panel-tag">[ REVEALING WINNER... ]</span>
								</div>
							{/if}

							<!-- PART 3: VOTING INFO & STANDINGS (REVEALS SLIGHTLY LATER IN PHASE 3, COMPACT AT BOTTOM) -->
							{#if revealPhase >= 3}
								<div class="standings-box-compact standings-enter-animated">
									<div class="panel-tag">[ CATEGORY VOTING BREAKDOWN ]</div>
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
							{/if}
						</section>
					{/if}
				{/if}
			</main>
		{/if}
	{/if}
</div>

<style>
	.reveal-flash-overlay {
		position: fixed;
		inset: 0;
		background: radial-gradient(circle at 50% 50%, rgba(0, 240, 255, 0.35), rgba(255, 215, 0, 0.25), transparent 70%);
		z-index: 100;
		pointer-events: none;
		animation: celebrateScale 0.5s ease-out forwards;
	}

	.tv-fullwidth-container {
		position: relative;
		z-index: 1;
		width: 100%;
		padding: 16px 24px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.tv-compact-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 28px;
		margin-bottom: 0;
	}

	.header-left {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.pulse-dot {
		width: 8px;
		height: 8px;
		background: var(--accent-cyan);
		display: inline-block;
		box-shadow: 0 0 10px var(--accent-cyan);
		animation: pulseGlow 1.2s infinite;
	}

	.poll-title-compact {
		font-size: 1.5rem;
		margin: 0;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.clock-display {
		font-family: var(--font-mono);
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--text-secondary);
		background: var(--bg-panel-elevated);
		padding: 6px 12px;
		border: 1px solid var(--border-subtle);
	}

	.ballot-counter {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
	}

	.ballot-counter .num {
		font-family: var(--font-mono);
		font-size: 1.6rem;
		font-weight: 800;
		color: var(--accent-cyan);
		line-height: 1;
	}

	.ballot-counter .lbl {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 700;
		color: var(--text-secondary);
	}

	.toast-notification {
		position: fixed;
		bottom: 32px;
		right: 32px;
		padding: 18px 32px;
		background: var(--accent-cyan);
		color: #000000;
		font-family: var(--font-mono);
		font-weight: 800;
		font-size: 1.1rem;
		border: 2px solid #ffffff;
		box-shadow: 0 0 35px rgba(0, 240, 255, 0.5);
		z-index: 99;
		animation: toastSlide 0.35s cubic-bezier(0.16, 1, 0.3, 1);
	}

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
		padding: 18px;
		background: #ffffff;
		border: var(--border-stark);
		box-shadow: 0 0 30px rgba(255, 255, 255, 0.2);
	}

	.qr-box img {
		display: block;
		width: 290px;
		height: 290px;
	}

	.url-text {
		font-family: var(--font-mono);
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--accent-cyan);
		background: var(--bg-panel-elevated);
		padding: 12px 24px;
		border: 1px solid var(--accent-cyan);
		box-shadow: 0 0 15px rgba(0, 240, 255, 0.2);
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
		display: inline-flex;
		align-items: center;
		gap: 10px;
		padding: 14px 24px;
		background: var(--bg-panel-elevated);
		border: 1px solid var(--accent-cyan);
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: 1.2rem;
		color: var(--text-primary);
		box-shadow: 4px 4px 0px rgba(0, 240, 255, 0.3);
		animation: popZoomIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.voter-dot {
		width: 8px;
		height: 8px;
		background: var(--accent-cyan);
		box-shadow: 0 0 8px var(--accent-cyan);
		border-radius: 50% !important;
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
		padding: 44px 48px;
		display: flex;
		flex-direction: column;
	}

	/* 3-PART SEQUENTIAL STAGING */

	/* PART 1: CATEGORY TITLE (0s) */
	.category-header-stage {
		animation: categoryTitleEnter 0.5s ease-out forwards;
	}

	.ceremony-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.cat-title-epic {
		font-size: 3.5rem;
		letter-spacing: 0.04em;
		line-height: 1.1;
		background: linear-gradient(180deg, #ffffff 60%, var(--text-secondary) 100%);
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	/* PART 2: WINNER CARD (+1.4s) */
	.winner-box-hero {
		padding: 36px 44px;
		background: radial-gradient(circle at 0% 50%, rgba(255, 215, 0, 0.16), transparent 75%), var(--bg-panel-elevated);
		border: 2px solid var(--accent-gold);
		box-shadow: var(--shadow-brutal-gold), var(--glow-gold);
		margin-bottom: 28px;
	}

	.winner-enter-animated {
		animation: winnerCardEnter 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}

	.winner-placeholder-card {
		padding: 40px;
		background: rgba(22, 22, 34, 0.4);
		border: 2px dashed rgba(255, 215, 0, 0.3);
		text-align: center;
		margin-bottom: 28px;
	}

	.winner-header-tag {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.trophy-icon {
		font-size: 2.2rem;
		filter: drop-shadow(0 0 10px var(--accent-gold));
	}

	.winner-name-epic {
		font-size: 4.4rem;
		font-weight: 800;
		color: var(--accent-gold);
		text-shadow: 0 0 30px rgba(255, 215, 0, 0.55);
		margin: 6px 0 10px;
		line-height: 1.05;
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

	/* PART 3: VOTING INFO & STANDINGS (+3.2s COMPACT AT BOTTOM) */
	.standings-box-compact {
		background: var(--bg-panel-elevated);
		padding: 24px 28px;
		border: var(--border-subtle);
	}

	.standings-enter-animated {
		animation: standingsEnter 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}

	.bars-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.bar-item {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.bar-info {
		display: flex;
		justify-content: space-between;
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: 0.95rem;
	}

	.bar-track {
		width: 100%;
		height: 24px;
		background: var(--bg-space);
		border: 1px solid var(--text-secondary);
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		background: var(--text-secondary);
		transition: width 0.7s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.bar-winner {
		background: linear-gradient(90deg, var(--accent-cyan), var(--accent-gold));
		box-shadow: 0 0 15px var(--accent-gold);
	}

	.space-v-lg { height: 28px; }
	.center-state { margin: auto; text-align: center; padding: 80px 24px; }
	.empty-voters-state { padding: 40px; text-align: center; }
	.muted-text { color: var(--text-dim); font-size: 1rem; }
</style>
