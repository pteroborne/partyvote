<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { playTapSound, playStepSound, playWinnerSound, playHoverSound } from '$lib/audio';

	let pollId = $derived(page.params.id);

	let pollData: any = $state(null);
	let loading = $state(true);
	let errorMsg = $state('');
	let nickname = $state('');
	let voterToken = $state('');

	// Multi-Step Wizard: 0 = Name Entry, 1..N = Categories, N+1 = Review & Submit
	let currentStep = $state(0);
	let isSubmitted = $state(false);
	let submitting = $state(false);

	let ballots: Record<string, any> = $state({});

	onMount(async () => {
		initVoterToken();
		await fetchPoll();
	});

	function initVoterToken() {
		let token = localStorage.getItem(`voter_token_${pollId}`);
		let savedName = localStorage.getItem(`voter_nickname_${pollId}`);
		if (!token) {
			token = 'voter-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
			localStorage.setItem(`voter_token_${pollId}`, token);
		}
		voterToken = token;
		if (savedName) {
			nickname = savedName;
		}
	}

	async function fetchPoll() {
		loading = true;
		try {
			const res = await fetch(`/api/polls/${pollId}`);
			const data = await res.json();
			if (res.ok) {
				pollData = data;
				initBallotState(data.categories);
			} else {
				errorMsg = data.error || 'Poll not found';
			}
		} catch (e: any) {
			errorMsg = e.message;
		} finally {
			loading = false;
		}
	}

	function initBallotState(categories: any[]) {
		const initialBallots: Record<string, any> = {};
		for (const catItem of categories) {
			const cat = catItem.category;
			const options = catItem.options;

			if (cat.votingStrategy === 'ranked-choice') {
				initialBallots[cat.id] = [];
			} else if (cat.votingStrategy === 'plurality') {
				initialBallots[cat.id] = options.length > 0 ? options[0].id : null;
			} else if (cat.votingStrategy === 'approval') {
				initialBallots[cat.id] = options.length > 0 ? [options[0].id] : [];
			} else if (cat.votingStrategy === 'score') {
				const scoreMap: Record<string, number> = {};
				options.forEach((o: any) => (scoreMap[o.id] = 5));
				initialBallots[cat.id] = scoreMap;
			}
		}
		ballots = initialBallots;
	}

	function assignRank(catId: string, optId: string, maxRanks: number = 3) {
		playTapSound();
		const currentList: string[] = [...(ballots[catId] || [])];
		if (currentList.includes(optId)) return;
		if (currentList.length >= maxRanks) return;
		currentList.push(optId);
		ballots[catId] = currentList;
	}

	function unassignRank(catId: string, optId: string) {
		playTapSound();
		const currentList: string[] = [...(ballots[catId] || [])];
		const idx = currentList.indexOf(optId);
		if (idx === -1) return;
		currentList.splice(idx, 1);
		ballots[catId] = currentList;
	}

	function moveRank(catId: string, optId: string, direction: 'up' | 'down') {
		playTapSound();
		const currentList: string[] = [...(ballots[catId] || [])];
		const idx = currentList.indexOf(optId);
		if (idx === -1) return;

		const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
		if (targetIdx < 0 || targetIdx >= currentList.length) return;

		const temp = currentList[idx];
		currentList[idx] = currentList[targetIdx];
		currentList[targetIdx] = temp;
		ballots[catId] = currentList;
	}

	function toggleApproval(catId: string, optId: string) {
		playTapSound();
		const currentList: string[] = [...(ballots[catId] || [])];
		const idx = currentList.indexOf(optId);
		if (idx > -1) {
			currentList.splice(idx, 1);
		} else {
			currentList.push(optId);
		}
		ballots[catId] = currentList;
	}

	function setScore(catId: string, optId: string, score: number) {
		playTapSound();
		const currentMap = { ...(ballots[catId] || {}) };
		currentMap[optId] = score;
		ballots[catId] = currentMap;
	}

	function proceedToNextStep() {
		if (currentStep === 0 && !nickname.trim()) {
			errorMsg = 'Please enter your name to proceed.';
			return;
		}
		errorMsg = '';
		playStepSound();
		currentStep++;
	}

	function prevStep() {
		errorMsg = '';
		playStepSound();
		if (currentStep > 0) currentStep--;
	}

	async function handleSubmit() {
		if (!nickname.trim()) {
			errorMsg = 'Please enter your name or nickname.';
			return;
		}
		errorMsg = '';
		submitting = true;
		localStorage.setItem(`voter_nickname_${pollId}`, nickname.trim());

		try {
			const res = await fetch(`/api/polls/${pollId}/vote`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					voterToken,
					nickname: nickname.trim(),
					ballots
				})
			});
			const data = await res.json();
			if (res.ok) {
				isSubmitted = true;
				playWinnerSound(); // Plays tactile seismic charge!
			} else {
				errorMsg = data.error || 'Failed to submit vote.';
			}
		} catch (e: any) {
			errorMsg = e.message;
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>{pollData?.poll?.title || 'Party Vote'} | Mobile Ballot</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
</svelte:head>

<div class="vote-space-layout">
	{#if loading}
		<div class="center-card empire-panel">
			<div class="panel-tag">[ INITIALIZATION ]</div>
			<h2>LOADING BALLOT...</h2>
		</div>
	{:else if errorMsg && !pollData}
		<div class="center-card empire-panel">
			<div class="panel-tag">[ ERROR ]</div>
			<h2>{errorMsg}</h2>
			<div class="space-v"></div>
			<a href="/" class="btn" onclick={playTapSound} onmouseenter={playHoverSound}>RETURN HOME</a>
		</div>
	{:else if pollData}
		{@const totalCategories = pollData.categories.length}
		{@const totalSteps = totalCategories + 1}

		<!-- Header -->
		<header class="empire-panel compact-header">
			<span class="page-title-subtle">[ OFFICIAL BALLOT ]</span>
			<h2>{pollData.poll.title}</h2>
		</header>

		{#if isSubmitted}
			<div class="empire-panel center-card celebrate-card">
				<div class="success-icon-badge">✓</div>
				<div class="panel-tag">[ SUBMISSION CONFIRMED ]</div>
				<h2>BALLOT RECORDED!</h2>
				<p class="thank-you-msg">Thank you for voting, <strong>{nickname}</strong>.</p>
				<p class="subtext">Watch the TV display for live updates and ceremony results.</p>
				<div class="space-v"></div>
				<button
					class="btn btn-primary"
					onclick={() => { isSubmitted = false; currentStep = 1; playTapSound(); }}
					onmouseenter={playHoverSound}
				>
					EDIT YOUR BALLOT
				</button>
			</div>
		{:else if pollData.poll.status !== 'active'}
			<div class="empire-panel center-card">
				<div class="panel-tag">[ STATUS ]</div>
				<h2>VOTING CLOSED</h2>
				<p class="subtext">Voting is currently closed. Watch the TV screen for winners reveal.</p>
			</div>
		{:else}
			{#if errorMsg}
				<div class="alert alert-error">{errorMsg}</div>
			{/if}

			<!-- Progress Bar -->
			<div class="step-progress-container">
				<div class="step-progress-bar">
					<div
						class="step-progress-fill"
						style="width: {((currentStep + 1) / (totalSteps + 1)) * 100}%"
					></div>
				</div>
				<span class="step-label-text">STEP {currentStep + 1} OF {totalSteps + 1}</span>
			</div>

			<!-- STEP 0: ENTER NAME -->
			{#if currentStep === 0}
				<div class="empire-panel wizard-step-card animated-step">
					<div class="panel-tag">[ STEP 1: IDENTIFICATION ]</div>
					<h2>ENTER YOUR NAME</h2>
					<p class="subtext">Your name will appear on the TV screen voter activity list.</p>
					<div class="space-v"></div>

					<input
						type="text"
						class="input-field"
						placeholder="e.g. Alex, Sam, Jordan..."
						bind:value={nickname}
					/>

					<div class="space-v"></div>

					<button class="btn btn-primary full-w" onclick={proceedToNextStep} onmouseenter={playHoverSound}>
						PROCEED TO VOTING →
					</button>
				</div>
			{/if}

			<!-- STEP 1..N: VOTE CATEGORY -->
			{#if currentStep >= 1 && currentStep <= totalCategories}
				{@const catIdx = currentStep - 1}
				{@const catItem = pollData.categories[catIdx]}
				{@const cat = catItem.category}
				{@const options = catItem.options}

				<div class="empire-panel wizard-step-card animated-step">
					<div class="step-head">
						<div class="panel-tag">[ CATEGORY {currentStep} OF {totalCategories} ]</div>
						<span class="badge badge-strategy">{cat.votingStrategy}</span>
					</div>

					<h2>{cat.title}</h2>
					{#if cat.description}<p class="subtext">{cat.description}</p>{/if}

					<div class="space-v"></div>

					<!-- Ranked Choice & Borda Count UI -->
					{#if cat.votingStrategy === 'ranked-choice' || cat.votingStrategy === 'borda-count'}
						{@const rankedList = ballots[cat.id] || []}
						{@const isBorda = cat.votingStrategy === 'borda-count'}
						{@const maxRanks = isBorda ? options.length : Math.min(3, options.length)}
						{@const rankLabels = isBorda
							? Array(options.length).fill(0).map((_, i) => `#${i + 1} CHOICE (+${options.length - i} pts)`)
							: ['1ST CHOICE 🥇', '2ND CHOICE 🥈', '3RD CHOICE 🥉']}

						<div class="rcv-top3-container">
							<div class="rcv-slots-section">
								<div class="rcv-section-title">[ YOUR TOP {maxRanks} PICKS ]</div>
								<div class="slots-grid">
									{#each Array(maxRanks) as _, slotIdx}
										{@const optId = rankedList[slotIdx]}
										{@const opt = optId ? options.find((o: any) => o.id === optId) : null}
										<div class="rank-slot-card {opt ? 'slot-filled' : 'slot-empty'}">
											<div class="slot-badge">{rankLabels[slotIdx] || `#${slotIdx + 1}`}</div>
											{#if opt}
												<div class="slot-content">
													<strong>{opt.title}</strong>
													{#if opt.description}<span class="opt-desc">{opt.description}</span>{/if}
												</div>
												<div class="slot-actions">
													{#if slotIdx > 0}
														<button
															class="btn-icon"
															title="Move up"
															onclick={() => moveRank(cat.id, opt.id, 'up')}
														>▲</button>
													{/if}
													{#if slotIdx < rankedList.length - 1}
														<button
															class="btn-icon"
															title="Move down"
															onclick={() => moveRank(cat.id, opt.id, 'down')}
														>▼</button>
													{/if}
													<button
														class="btn-icon btn-remove"
														title="Remove choice"
														onclick={() => unassignRank(cat.id, opt.id)}
													>✕</button>
												</div>
											{:else}
												<div class="slot-placeholder">
													<span>Tap candidate below to select</span>
												</div>
											{/if}
										</div>
									{/each}
								</div>
							</div>

							<div class="rcv-pool-section">
								<div class="rcv-section-title">[ CANDIDATE SELECTION POOL ]</div>
								<div class="options-column">
									{#each options as opt}
										{@const currentRankIdx = rankedList.indexOf(opt.id)}
										{@const isSelected = currentRankIdx !== -1}
										{@const isPoolDisabled = !isSelected && rankedList.length >= maxRanks}

										<button
											class="opt-btn-card {isSelected ? 'opt-ranked-active' : ''} {isPoolDisabled ? 'opt-pool-full' : ''}"
											disabled={isPoolDisabled}
											onmouseenter={playHoverSound}
											onclick={() => {
												if (isSelected) {
													unassignRank(cat.id, opt.id);
												} else {
													assignRank(cat.id, opt.id, maxRanks);
												}
											}}
										>
											<div class="rank-indicator">
												{#if isSelected}
													<span class="rank-num-badge">#{currentRankIdx + 1}</span>
												{:else}
													<span class="rank-add-badge">+</span>
												{/if}
											</div>
											<div class="opt-content">
												<strong>{opt.title}</strong>
												{#if opt.description}<span class="opt-desc">{opt.description}</span>{/if}
											</div>
										</button>
									{/each}
								</div>
							</div>
						</div>
					{/if}

					<!-- Plurality UI -->
					{#if cat.votingStrategy === 'plurality'}
						<div class="options-column">
							{#each options as opt}
								<button
									class="opt-btn-card {ballots[cat.id] === opt.id ? 'opt-active' : ''}"
									onmouseenter={playHoverSound}
									onclick={() => { playTapSound(); ballots[cat.id] = opt.id; }}
								>
									<div class="opt-content">
										<strong>{opt.title}</strong>
										{#if opt.description}<span class="opt-desc">{opt.description}</span>{/if}
									</div>
									{#if ballots[cat.id] === opt.id}
										<span class="active-check">✓</span>
									{/if}
								</button>
							{/each}
						</div>
					{/if}

					<!-- Approval UI -->
					{#if cat.votingStrategy === 'approval'}
						<div class="options-column">
							{#each options as opt}
								{@const isApproved = (ballots[cat.id] || []).includes(opt.id)}
								<button
									class="opt-btn-card {isApproved ? 'opt-active' : ''}"
									onmouseenter={playHoverSound}
									onclick={() => toggleApproval(cat.id, opt.id)}
								>
									<div class="opt-content">
										<strong>{opt.title}</strong>
										{#if opt.description}<span class="opt-desc">{opt.description}</span>{/if}
									</div>
									{#if isApproved}
										<span class="active-check">✓ APPROVED</span>
									{/if}
								</button>
							{/each}
						</div>
					{/if}

					<!-- Score UI -->
					{#if cat.votingStrategy === 'score'}
						<div class="score-column">
							{#each options as opt}
								{@const currentRating = (ballots[cat.id] || {})[opt.id] || 5}
								<div class="score-item-box">
									<div class="score-header-info">
										<strong>{opt.title}</strong>
										{#if opt.description}<span class="opt-desc">{opt.description}</span>{/if}
									</div>
									<div class="star-row">
										{#each [1, 2, 3, 4, 5] as star}
											<button
												class="star-tap {star <= currentRating ? 'star-gold' : ''}"
												onmouseenter={playHoverSound}
												onclick={() => setScore(cat.id, opt.id, star)}
											>
												★
											</button>
										{/each}
										<span class="star-num-badge">{currentRating}/5</span>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					<div class="space-v"></div>

					<div class="wizard-nav-row">
						<button class="btn" onclick={prevStep} onmouseenter={playHoverSound}>← PREVIOUS</button>
						<button class="btn btn-primary" onclick={proceedToNextStep} onmouseenter={playHoverSound}>
							{currentStep < totalCategories ? 'NEXT CATEGORY →' : 'REVIEW BALLOT →'}
						</button>
					</div>
				</div>
			{/if}

			<!-- FINAL STEP: REVIEW & SUBMIT -->
			{#if currentStep === totalSteps}
				<div class="empire-panel wizard-step-card animated-step">
					<div class="panel-tag">[ FINAL STEP: REVIEW & CONFIRM ]</div>
					<h2>CONFIRM YOUR BALLOT</h2>
					<p class="subtext">Review your selections before submitting.</p>
					<div class="space-v"></div>

					<div class="review-box">
						<div class="review-row">
							<span class="lbl">VOTER NAME:</span>
							<strong>{nickname}</strong>
						</div>
						<div class="review-row">
							<span class="lbl">COMPLETED CATEGORIES:</span>
							<strong>{totalCategories} Categories</strong>
						</div>
					</div>

					<div class="space-v"></div>

					<div class="wizard-nav-row">
						<button class="btn" onclick={prevStep} onmouseenter={playHoverSound}>← BACK</button>
						<button
							class="btn btn-primary flex-1"
							disabled={submitting}
							onclick={handleSubmit}
							onmouseenter={playHoverSound}
						>
							{submitting ? 'SUBMITTING...' : 'CONFIRM & SUBMIT BALLOT'}
						</button>
					</div>
				</div>
			{/if}
		{/if}
	{/if}
</div>

<style>
	.vote-space-layout {
		max-width: 560px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.compact-header {
		text-align: center;
		padding: 20px 24px;
		margin-bottom: 0;
	}

	.step-progress-container {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.step-progress-bar {
		height: 7px;
		background: rgba(255, 255, 255, 0.12);
		border-radius: 0;
		overflow: hidden;
	}

	.step-progress-fill {
		height: 100%;
		background: var(--accent-cyan);
		box-shadow: 0 0 12px var(--accent-cyan);
		transition: width 0.35s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.step-label-text {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--accent-cyan);
		letter-spacing: 0.12em;
		text-align: right;
	}

	.center-card {
		text-align: center;
		padding: 40px 24px;
	}

	.celebrate-card {
		border-color: var(--accent-cyan);
		box-shadow: var(--glow-cyan);
		animation: celebrateScale 0.45s ease-out;
	}

	.animated-step {
		animation: popZoomIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.success-icon-badge {
		width: 64px;
		height: 64px;
		margin: 0 auto 16px;
		background: var(--accent-cyan);
		color: #000000;
		font-size: 2.2rem;
		font-weight: 800;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: var(--glow-cyan);
	}

	.thank-you-msg {
		font-size: 1.1rem;
		margin-top: 8px;
	}

	.subtext {
		color: var(--text-secondary);
		font-size: 0.9rem;
		margin-top: 4px;
	}

	.wizard-step-card {
		display: flex;
		flex-direction: column;
		padding: 32px 24px;
	}

	.step-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}

	.wizard-nav-row {
		display: flex;
		gap: 12px;
		justify-content: space-between;
	}

	.full-w { width: 100%; }
	.flex-1 { flex: 1; }

	.review-box {
		background: var(--bg-panel-elevated);
		border: 1px solid var(--accent-cyan);
		box-shadow: 0 0 15px rgba(0, 240, 255, 0.15);
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.review-row {
		display: flex;
		justify-content: space-between;
		font-family: var(--font-mono);
		font-size: 0.9rem;
	}

	.review-row .lbl {
		color: var(--text-secondary);
	}

	.rcv-top3-container {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.rcv-section-title {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--accent-cyan);
		letter-spacing: 0.1em;
		margin-bottom: 10px;
	}

	.slots-grid {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.rank-slot-card {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		background: var(--bg-panel-elevated);
		transition: all 0.2s ease;
	}

	.slot-filled {
		border: 2px solid var(--accent-cyan);
		box-shadow: 4px 4px 0px var(--accent-cyan), var(--glow-cyan);
	}

	.slot-empty {
		border: 2px dashed rgba(255, 255, 255, 0.2);
		opacity: 0.7;
	}

	.slot-badge {
		font-family: var(--font-mono);
		font-weight: 800;
		font-size: 0.75rem;
		padding: 6px 10px;
		background: var(--bg-space);
		border: 1px solid var(--accent-cyan);
		color: var(--accent-cyan);
		white-space: nowrap;
	}

	.slot-filled .slot-badge {
		background: var(--accent-cyan);
		color: #000000;
	}

	.slot-content {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.opt-desc {
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.slot-placeholder {
		flex: 1;
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--text-dim);
		font-style: italic;
	}

	.slot-actions {
		display: flex;
		gap: 6px;
	}

	.btn-icon {
		padding: 6px 10px;
		font-family: var(--font-mono);
		font-size: 0.8rem;
		background: var(--bg-panel);
		border: 1px solid var(--border-subtle);
		color: #ffffff;
		cursor: pointer;
	}

	.btn-icon:hover {
		border-color: var(--accent-cyan);
		color: var(--accent-cyan);
	}

	.btn-remove:hover {
		border-color: var(--accent-red);
		color: var(--accent-red);
	}

	.options-column {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.opt-btn-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		background: var(--bg-panel-elevated);
		border: 1px solid var(--border-subtle);
		color: #ffffff;
		text-align: left;
		cursor: pointer;
		transition: all 0.18s ease;
	}

	.opt-btn-card:hover:not(:disabled) {
		border-color: #ffffff;
		transform: translateX(6px);
		box-shadow: 4px 4px 0px rgba(255, 255, 255, 0.1);
	}

	.opt-active {
		border: 2px solid var(--accent-cyan);
		background: rgba(0, 240, 255, 0.12);
		box-shadow: 4px 4px 0px var(--accent-cyan), var(--glow-cyan);
	}

	.opt-ranked-active {
		border: 2px solid var(--accent-cyan);
		background: rgba(0, 240, 255, 0.12);
	}

	.opt-pool-full {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.rank-indicator {
		margin-right: 12px;
	}

	.rank-num-badge {
		font-family: var(--font-mono);
		font-weight: 800;
		font-size: 0.85rem;
		padding: 4px 8px;
		background: var(--accent-cyan);
		color: #000000;
	}

	.rank-add-badge {
		font-family: var(--font-mono);
		font-size: 1.1rem;
		color: var(--text-dim);
	}

	.active-check {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		font-weight: 800;
		color: var(--accent-cyan);
	}

	.score-column {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.score-item-box {
		padding: 16px;
		background: var(--bg-panel-elevated);
		border: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.star-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.star-tap {
		background: none;
		border: none;
		font-size: 1.7rem;
		color: rgba(255, 255, 255, 0.2);
		cursor: pointer;
		transition: transform 0.12s ease, color 0.12s ease;
	}

	.star-tap:hover {
		transform: scale(1.3);
	}

	.star-gold {
		color: var(--accent-gold);
		text-shadow: 0 0 12px var(--accent-gold);
	}

	.star-num-badge {
		margin-left: auto;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		font-weight: 700;
		padding: 4px 8px;
		background: rgba(255, 215, 0, 0.18);
		color: var(--accent-gold);
		border: 1px solid var(--accent-gold);
		box-shadow: 0 0 10px rgba(255, 215, 0, 0.2);
	}
</style>
