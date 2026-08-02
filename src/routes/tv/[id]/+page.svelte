<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import QRCode from 'qrcode';
	import TvBackgroundCanvas from '$lib/components/TvBackgroundCanvas.svelte';
	import { playTransitionSound, playStepSound, playWinnerSound } from '$lib/audio';

	let pollId = $derived(page.params.id);

	let pollData: any = $state(null);
	let qrDataUrl = $state('');
	let guestVoteUrl = $state('');
	let loading = $state(true);
	let errorMsg = $state('');
	let recentVoterNotification = $state('');
	let eventSource: EventSource | null = null;
	let isFxEnabled = $state(true);
	let isSoundEnabled = $state(true);
	let clockTime = $state('');
	let clockInterval: NodeJS.Timeout | null = null;
	let revealFlash = $state(false);

	let activeWipe = $state<string | null>(null);
	let prevRevealStep = $state(0);
	let prevRevealSubStep = $state(-1);

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
		if (clockInterval) clearInterval(clockInterval);
	});

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
				const currentSubStep = data.poll.currentRevealSubStep ?? 0;

				if (currentStep !== prevRevealStep || currentSubStep !== prevRevealSubStep) {
					handleStepTransition(currentStep, currentSubStep, data);
				}

				prevRevealStep = currentStep;
				prevRevealSubStep = currentSubStep;
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

	function handleStepTransition(step: number, subStep: number, data: any) {
		if (step === 0) return;
		const catItem = data?.categories?.[step - 1];
		if (!catItem) return;

		if (subStep === 0) {
			activeWipe = 'shutter';
			if (isSoundEnabled) playTransitionSound('shutter');
			setTimeout(() => (activeWipe = null), 600);
		} else if (subStep === 99) {
			activeWipe = 'cyber-grid';
			revealFlash = true;
			if (isSoundEnabled) playWinnerSound();
			setTimeout(() => (revealFlash = false), 600);
			setTimeout(() => (activeWipe = null), 800);
		} else if (catItem.category?.votingStrategy === 'ranked-choice') {
			if (isSoundEnabled) playStepSound();
		}
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
</script>

<svelte:head>
	<title>{pollData?.poll?.title || 'Party Vote'} | Broadcast Display</title>
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
			<h2>LOADING BROADCAST DISPLAY...</h2>
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

		<!-- BROADCAST TV HEADER (CLEAN & NON-INTERACTIVE) -->
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
			<!-- CEREMONY MODE: BROADCAST STAGING -->
			<main class="ceremony-container">
				{#if revealStep === 0}
					<section class="empire-panel ceremony-hero">
						<div class="panel-tag">[ VOTING CLOSED ]</div>
						<h2>PRESENTATION CEREMONY READY</h2>
						<p class="muted-text">Waiting for host to start category reveals on Host Admin console.</p>
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
						{@const subStep = poll.currentRevealSubStep ?? 0}

						<section class="empire-panel ceremony-hero">
							<!-- STAGE 1: CATEGORY INTRO CARD (When subStep === 0) -->
							{#if subStep === 0}
								<div class="category-header-stage cat-intro-center">
									<div class="ceremony-meta">
										<div class="panel-tag">[ CATEGORY {revealStep} OF {categories.length} ]</div>
										<span class="badge badge-strategy">{cat.votingStrategy}</span>
									</div>
									<h1 class="cat-title-epic">{cat.title}</h1>
									{#if cat.description}
										<p class="cat-desc-epic">{cat.description}</p>
									{/if}
									<div class="space-v-lg"></div>
									<div class="stage-tag-subtle">[ REVEAL COMMENCING ON HOST SIGNAL ]</div>
								</div>
							{:else if subStep === 99 || (cat.votingStrategy !== 'ranked-choice' && subStep > 0)}
								<!-- STAGE 3: WINNER FINALE CARD (When subStep === 99 or non-RCV revealed) -->
								<div class="category-header-stage">
									<div class="ceremony-meta">
										<div class="panel-tag">[ CATEGORY {revealStep} OF {categories.length} ]</div>
										<span class="badge badge-strategy">{cat.votingStrategy}</span>
									</div>
									<h1 class="cat-title-epic">{cat.title}</h1>
								</div>

								<div class="space-v-lg"></div>

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

								<!-- Compact Final Standings -->
								<div class="standings-box-compact standings-enter-animated">
									<div class="panel-tag">[ FINAL VOTING BREAKDOWN ]</div>
									<div class="space-v"></div>

									<div class="bars-list">
										{#each result.rankings as r, rIdx}
											<div class="bar-item">
												<div class="bar-info">
													<span class="rank">
														#{rIdx + 1} {r.title}
														{#if cat.votingStrategy === 'borda-count' && r.bordaBreakdown}
															<span class="borda-rank-chips">
																{#each r.bordaBreakdown as seg}
																	{#if seg.count > 0}
																		<span class="borda-chip rank-bg-{seg.rank}">
																			{seg.rank === 1 ? '🥇' : seg.rank === 2 ? '🥈' : seg.rank === 3 ? '🥉' : `#${seg.rank}`} {seg.count}× ({seg.totalPoints}pt)
																		</span>
																	{/if}
																{/each}
															</span>
														{/if}
													</span>
													<span class="tally">{r.votes} {cat.votingStrategy === 'borda-count' ? 'Borda points' : 'votes'} ({r.percentage}%)</span>
												</div>
												<div class="bar-track">
													{#if cat.votingStrategy === 'borda-count' && r.bordaBreakdown && r.votes > 0}
														<div class="bar-fill-stacked" style="width: {Math.max(r.percentage, 4)}%;">
															{#each r.bordaBreakdown as seg}
																{#if seg.totalPoints > 0}
																	{@const segPct = (seg.totalPoints / r.votes) * 100}
																	<div
																		class="stacked-segment rank-segment-{seg.rank}"
																		style="width: {segPct}%;"
																		title="{seg.rank === 1 ? '1st Choice' : seg.rank === 2 ? '2nd Choice' : seg.rank === 3 ? '3rd Choice' : `${seg.rank}th Choice`}: {seg.count} votes × {seg.ptsPerVote} pts = {seg.totalPoints} pts"
																	></div>
																{/if}
															{/each}
														</div>
													{:else}
														<div
															class="bar-fill {rIdx === 0 ? 'bar-winner' : ''}"
															style="width: {Math.max(r.percentage, 4)}%;"
														></div>
													{/if}
												</div>
											</div>
										{/each}
									</div>
								</div>
							{:else if cat.votingStrategy === 'ranked-choice' && result.rcvRounds && result.rcvRounds.length > 0}
								<!-- STAGE 2: RCV ROUND STORYLINE (When subStep is 1..M) -->
								{@const optionTitleMap = new Map((catItem.options || []).map((o: any) => [o.id, o.title]))}
								{@const rcvRounds = result.rcvRounds}
								{@const currentRoundIdx = Math.min(Math.max(0, subStep - 1), rcvRounds.length - 1)}
								{@const round = rcvRounds[currentRoundIdx]}
								{@const exhaustedCount = round.exhaustedCount || 0}
								{@const exhaustedPct = result.totalBallots > 0 ? Math.round((exhaustedCount / result.totalBallots) * 100) : 0}

								<div class="category-header-stage">
									<div class="ceremony-meta">
										<div class="panel-tag">[ CATEGORY {revealStep} OF {categories.length} // INSTANT RUNOFF ]</div>
										<span class="badge badge-strategy">Ranked Choice (Round {round.roundNumber} of {rcvRounds.length})</span>
									</div>
									<h1 class="cat-title-epic-sm">{cat.title}</h1>
								</div>

								<div class="space-v"></div>

								<div class="rcv-breakdown-single-pane empire-panel-subtle">
									<div class="rcv-round-note-banner">
										<span class="pulse-dot"></span>
										<span class="round-num-label">ROUND {round.roundNumber} STANDINGS:</span>
										<span class="round-note-text">{round.note || 'Active Tally'}</span>
									</div>

									<div class="space-v"></div>

									<!-- Single-Pane Candidate Bars List -->
									<div class="bars-list">
										{#each catItem.options as opt}
											{@const vCount = round.tallies[opt.id] ?? 0}
											{@const pct = result.totalBallots > 0 ? Math.round((vCount / result.totalBallots) * 100) : 0}
											{@const isEliminatedInThisRound = round.eliminatedOptionId === opt.id}
											{@const isEliminatedInEarlierRound = round.tallies[opt.id] === undefined}
											{@const isWinnerInFinalRound = result.winnerOptionId === opt.id && currentRoundIdx === rcvRounds.length - 1}
											{@const transferredInCount = round.transfers?.[opt.id] || 0}

											<div class="bar-item {isEliminatedInThisRound ? 'bar-item-eliminated' : ''} {isWinnerInFinalRound ? 'bar-item-winner' : ''} {isEliminatedInEarlierRound ? 'bar-item-collapsed' : ''}">
												<div class="bar-info">
													<span class="rank">
														{opt.title}
														{#if isEliminatedInThisRound}
															<span class="badge badge-eliminated">❌ OUT IN ROUND {round.roundNumber}</span>
														{:else if isWinnerInFinalRound}
															<span class="badge badge-winner-tag">🏆 WINNER</span>
														{:else if transferredInCount > 0}
															<span class="badge badge-transferred-tag">➜ +{transferredInCount} transferred</span>
														{/if}
													</span>
													<span class="tally">{vCount} votes ({pct}%)</span>
												</div>
												<div class="bar-track">
													<div
														class="bar-fill {isEliminatedInThisRound ? 'bar-fill-eliminated' : isWinnerInFinalRound ? 'bar-winner' : ''}"
														style="width: {Math.max(pct, isEliminatedInThisRound || vCount > 0 ? 4 : 0)}%;"
													></div>
												</div>
											</div>
										{/each}

										<!-- Exhausted Ballots Progress Bar -->
										<div class="bar-item bar-item-exhausted-track">
											<div class="bar-info">
												<span class="rank exhausted-track-label">
													💨 Exhausted / Rolled Off Ballots
													<span class="muted-text-sm">(No remaining choices ranked)</span>
												</span>
												<span class="tally">{exhaustedCount} votes ({exhaustedPct}%)</span>
											</div>
											<div class="bar-track bar-track-exhausted">
												<div
													class="bar-fill bar-fill-exhausted"
													style="width: {Math.max(exhaustedPct, exhaustedCount > 0 ? 4 : 0)}%;"
												></div>
											</div>
										</div>
									</div>

									<!-- Inline Round Transfer Summary -->
									{#if round.eliminatedOptionId && (round.transfers ? Object.entries(round.transfers) : []).length > 0}
										{@const transfersList = Object.entries(round.transfers) as [string, number][]}
										<div class="space-v"></div>
										<div class="inline-transfer-summary">
											<div class="transfer-summary-header">
												<span class="icon">⚡</span>
												VOTE REDISTRIBUTION FLOW (ROUND {round.roundNumber}):
											</div>
											<div class="transfer-summary-chips">
												{#each transfersList as [targetId, count]}
													{#if targetId === 'exhausted'}
														<span class="chip chip-exhausted">💨 {count} ballot{count > 1 ? 's' : ''} exhausted</span>
													{:else}
														<span class="chip chip-transferred">➜ +{count} transferred to <strong>{optionTitleMap.get(targetId) || targetId}</strong></span>
													{/if}
												{/each}
											</div>
										</div>
									{/if}
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

	.ceremony-hero {
		padding: 44px 48px;
		display: flex;
		flex-direction: column;
	}

	.cat-intro-center {
		text-align: center;
		padding: 60px 24px;
	}

	.cat-desc-epic {
		font-size: 1.3rem;
		color: var(--text-secondary);
		margin-top: 16px;
	}

	.stage-tag-subtle {
		font-family: var(--font-mono);
		font-weight: 800;
		color: var(--accent-cyan);
		font-size: 0.95rem;
		letter-spacing: 0.1em;
	}

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

	.cat-title-epic-sm {
		font-size: 2.2rem;
		letter-spacing: 0.03em;
		color: #ffffff;
		margin: 0;
	}

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

	.standings-box-compact {
		background: var(--bg-panel-elevated);
		padding: 24px 28px;
		border: var(--border-subtle);
	}

	.standings-enter-animated {
		animation: standingsEnter 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}

	.rcv-breakdown-container {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.rcv-round-note-banner {
		display: flex;
		align-items: center;
		gap: 10px;
		background: rgba(0, 240, 255, 0.08);
		border: 1px solid var(--accent-cyan);
		padding: 10px 16px;
		font-family: var(--font-mono);
		font-size: 0.95rem;
	}

	.round-num-label {
		color: var(--accent-cyan);
		font-weight: 800;
	}

	.round-note-text {
		color: var(--text-primary);
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

	.bar-item-eliminated {
		opacity: 0.7;
	}

	.badge-eliminated {
		background: rgba(255, 60, 60, 0.2);
		color: #ff5555;
		border: 1px solid #ff5555;
		font-size: 0.7rem;
		padding: 2px 6px;
		margin-left: 8px;
	}

	.badge-winner-tag {
		background: rgba(255, 215, 0, 0.2);
		color: var(--accent-gold);
		border: 1px solid var(--accent-gold);
		font-size: 0.7rem;
		padding: 2px 6px;
		margin-left: 8px;
	}

	.bar-fill-eliminated {
		background: #ff5555 !important;
		box-shadow: 0 0 10px rgba(255, 85, 85, 0.5);
	}

	.elim-text { color: #ff6666; font-weight: 700; }
	.win-text { color: var(--accent-gold); font-weight: 800; }

	/* DRAMATIC ELIMINATION SPLASH OVERLAY */
	.elimination-splash-overlay {
		position: fixed;
		inset: 0;
		background: rgba(10, 5, 15, 0.88);
		backdrop-filter: blur(10px);
		z-index: 95;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		animation: popZoomIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}

	.elimination-splash-card {
		background: radial-gradient(circle at 50% 50%, rgba(255, 60, 60, 0.25), transparent 75%), var(--bg-panel-elevated);
		border: 3px solid #ff4444;
		box-shadow: 0 0 60px rgba(255, 68, 68, 0.7), var(--shadow-brutal-gold);
		padding: 44px 56px;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		max-width: 800px;
		width: 90%;
	}

	.splash-tag {
		font-family: var(--font-mono);
		font-weight: 800;
		color: #ff5555;
		font-size: 1.15rem;
		letter-spacing: 0.08em;
	}

	.splash-candidate-name {
		font-size: 3.2rem;
		font-weight: 800;
		color: #ffffff;
		text-shadow: 0 0 30px rgba(255, 85, 85, 0.8);
		margin: 0;
		line-height: 1.1;
	}

	.splash-sub {
		font-family: var(--font-mono);
		color: var(--text-secondary);
		font-size: 1.05rem;
		font-weight: 700;
		margin: 0;
	}

	.splash-transfer-preview {
		margin-top: 14px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}

	.splash-transfer-tag {
		font-family: var(--font-mono);
		color: var(--accent-cyan);
		font-size: 0.85rem;
		font-weight: 800;
	}

	.splash-chips {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		justify-content: center;
	}

	.splash-chip {
		font-family: var(--font-mono);
		font-size: 0.9rem;
		font-weight: 700;
		padding: 6px 12px;
		border-radius: 4px;
	}

	/* RCV DUAL PANE STORY GRID */
	.rcv-dual-pane-grid {
		display: grid;
		grid-template-columns: 58% 40%;
		gap: 2%;
		width: 100%;
		margin-top: 12px;
	}

	@media (max-width: 1100px) {
		.rcv-dual-pane-grid {
			grid-template-columns: 1fr;
		}
	}

	.rcv-pane-left, .rcv-pane-right {
		padding: 22px 26px;
		display: flex;
		flex-direction: column;
	}

	.bar-item-collapsed {
		opacity: 0.25;
		max-height: 28px;
		overflow: hidden;
		transition: all 0.5s ease-out;
	}

	.badge-transferred-tag {
		background: rgba(0, 240, 255, 0.2);
		color: var(--accent-cyan);
		border: 1px solid var(--accent-cyan);
		font-size: 0.7rem;
		padding: 2px 6px;
		margin-left: 8px;
		animation: pulseGlow 1.2s infinite;
	}

	.bar-item-exhausted-track {
		margin-top: 14px;
		padding-top: 12px;
		border-top: 1px dashed var(--border-subtle);
	}

	.exhausted-track-label {
		color: var(--accent-gold);
		font-weight: 700;
	}

	.muted-text-sm {
		color: var(--text-dim);
		font-size: 0.75rem;
		font-weight: 400;
	}

	.bar-track-exhausted {
		background: rgba(255, 180, 0, 0.08) !important;
		border: 1px dashed var(--accent-gold) !important;
	}

	.bar-fill-exhausted {
		background: linear-gradient(90deg, rgba(255, 180, 0, 0.4), var(--accent-gold)) !important;
		box-shadow: 0 0 10px rgba(255, 180, 0, 0.3);
	}

	/* SINGLE PANE RCV BREAKDOWN STYLING */
	.rcv-breakdown-single-pane {
		padding: 28px 32px;
		display: flex;
		flex-direction: column;
		width: 100%;
	}

	.inline-transfer-summary {
		background: var(--bg-space);
		border: 1px solid var(--border-subtle);
		padding: 16px 20px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		font-family: var(--font-mono);
	}

	.transfer-summary-header {
		font-weight: 800;
		color: var(--accent-cyan);
		font-size: 0.9rem;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.transfer-summary-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.chip {
		font-size: 0.85rem;
		font-weight: 700;
		padding: 4px 10px;
		border-radius: 3px;
	}

	/* STACKED BORDA ACCUMULATION BAR STYLING */
	.bar-fill-stacked {
		height: 100%;
		display: flex;
		overflow: hidden;
		transition: width 0.7s cubic-bezier(0.16, 1, 0.3, 1);
		box-shadow: 0 0 12px rgba(255, 215, 0, 0.25);
	}

	.stacked-segment {
		height: 100%;
		transition: width 0.5s ease-out;
		position: relative;
	}

	/* Rank 1: Metallic Gold */
	.rank-segment-1 {
		background: linear-gradient(90deg, #ffe066, #ffd700, #ffb700);
		box-shadow: inset 0 0 6px rgba(255, 255, 255, 0.6);
	}

	/* Rank 2: Metallic Silver */
	.rank-segment-2 {
		background: linear-gradient(90deg, #f0f0f0, #c0c0c0, #a0a0a0);
		box-shadow: inset 0 0 6px rgba(255, 255, 255, 0.5);
	}

	/* Rank 3: Metallic Bronze */
	.rank-segment-3 {
		background: linear-gradient(90deg, #e59866, #cd7f32, #995c26);
		box-shadow: inset 0 0 6px rgba(255, 255, 255, 0.4);
	}

	/* Rank 4: Electric Cyan */
	.rank-segment-4 {
		background: linear-gradient(90deg, #80f5ff, #00f0ff, #0099cc);
	}

	/* Rank 5+: Neon Purple */
	.rank-segment-5, .rank-segment-6, .rank-segment-7, .rank-segment-8 {
		background: linear-gradient(90deg, #c084fc, #a855f7, #7e22ce);
	}

	/* BORDA BREAKDOWN CHIPS */
	.borda-rank-chips {
		display: inline-flex;
		gap: 6px;
		margin-left: 10px;
		vertical-align: middle;
	}

	.borda-chip {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		font-weight: 800;
		padding: 2px 7px;
		border-radius: 3px;
	}

	.rank-bg-1 {
		background: rgba(255, 215, 0, 0.25);
		color: var(--accent-gold);
		border: 1px solid var(--accent-gold);
	}

	.rank-bg-2 {
		background: rgba(220, 220, 220, 0.25);
		color: #e0e0e0;
		border: 1px solid #c0c0c0;
	}

	.rank-bg-3 {
		background: rgba(205, 127, 50, 0.25);
		color: #e59866;
		border: 1px solid #cd7f32;
	}

	.rank-bg-4 {
		background: rgba(0, 240, 255, 0.2);
		color: var(--accent-cyan);
		border: 1px solid var(--accent-cyan);
	}

	.rank-bg-5, .rank-bg-6, .rank-bg-7, .rank-bg-8 {
		background: rgba(168, 85, 247, 0.2);
		color: #c084fc;
		border: 1px solid #a855f7;
	}

	.space-v-lg { height: 28px; }
	.center-state { margin: auto; text-align: center; padding: 80px 24px; }
	.empty-voters-state { padding: 40px; text-align: center; }
	.muted-text { color: var(--text-dim); font-size: 1rem; }
</style>
