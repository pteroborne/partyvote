<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';

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
				initialBallots[cat.id] = options.map((o: any) => o.id);
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

	function moveRank(catId: string, optId: string, direction: 'up' | 'down') {
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
		currentStep++;
	}

	function prevStep() {
		errorMsg = '';
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
			<a href="/" class="btn">RETURN HOME</a>
		</div>
	{:else if pollData}
		{@const totalCategories = pollData.categories.length}
		{@const totalSteps = totalCategories + 1} // Step 0: Name, Step 1..N: Categories

		<!-- Compact Header -->
		<header class="empire-panel compact-header">
			<span class="page-title-subtle">[ OFFICIAL BALLOT ]</span>
			<h2>{pollData.poll.title}</h2>
		</header>

		{#if isSubmitted}
			<div class="empire-panel center-card">
				<div class="panel-tag">[ SUBMISSION CONFIRMED ]</div>
				<h2>BALLOT RECORDED</h2>
				<p>Thank you for voting, <strong>{nickname}</strong>.</p>
				<p class="subtext">Watch the TV display for live updates and ceremony results.</p>
				<div class="space-v"></div>
				<button class="btn" onclick={() => { isSubmitted = false; currentStep = 1; }}>
					EDIT BALLOT
				</button>
			</div>
		{:else if pollData.poll.status !== 'active'}
			<div class="empire-panel center-card">
				<div class="panel-tag">[ STATUS ]</div>
				<h2>VOTING CLOSED</h2>
				<p class="subtext">Voting is closed. Watch the TV screen for winners.</p>
			</div>
		{:else}
			{#if errorMsg}
				<div class="alert alert-error">{errorMsg}</div>
			{/if}

			<!-- Progress Step Indicator -->
			<div class="step-progress-bar">
				<span>STEP {currentStep + 1} OF {totalSteps + 1}</span>
			</div>

			<!-- STEP 0: ENTER NAME -->
			{#if currentStep === 0}
				<div class="empire-panel wizard-step-card">
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

					<button class="btn btn-primary full-w" onclick={proceedToNextStep}>
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

				<div class="empire-panel wizard-step-card">
					<div class="step-head">
						<div class="panel-tag">[ CATEGORY {currentStep} OF {totalCategories} ]</div>
						<span class="badge badge-strategy">{cat.votingStrategy}</span>
					</div>

					<h2>{cat.title}</h2>
					{#if cat.description}<p class="subtext">{cat.description}</p>{/if}

					<div class="space-v"></div>

					<!-- Ranked Choice UI -->
					{#if cat.votingStrategy === 'ranked-choice'}
						<div class="rcv-list">
							{#each (ballots[cat.id] || []) as optId, rankIdx}
								{@const opt = options.find((o: any) => o.id === optId)}
								{#if opt}
									<div class="rcv-card">
										<div class="rank-num">#{rankIdx + 1}</div>
										<div class="rcv-info">
											<strong>{opt.title}</strong>
											{#if opt.description}<span class="opt-desc">{opt.description}</span>{/if}
										</div>
										<div class="rcv-buttons">
											<button
												class="btn-order"
												disabled={rankIdx === 0}
												onclick={() => moveRank(cat.id, opt.id, 'up')}
											>
												UP
											</button>
											<button
												class="btn-order"
												disabled={rankIdx === (ballots[cat.id] || []).length - 1}
												onclick={() => moveRank(cat.id, opt.id, 'down')}
											>
												DOWN
											</button>
										</div>
									</div>
								{/if}
							{/each}
						</div>
					{/if}

					<!-- Plurality UI -->
					{#if cat.votingStrategy === 'plurality'}
						<div class="options-column">
							{#each options as opt}
								<button
									class="opt-btn-card {ballots[cat.id] === opt.id ? 'opt-active' : ''}"
									onclick={() => (ballots[cat.id] = opt.id)}
								>
									<div class="opt-content">
										<strong>{opt.title}</strong>
										{#if opt.description}<span class="opt-desc">{opt.description}</span>{/if}
									</div>
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
									onclick={() => toggleApproval(cat.id, opt.id)}
								>
									<div class="opt-content">
										<strong>{opt.title}</strong>
										{#if opt.description}<span class="opt-desc">{opt.description}</span>{/if}
									</div>
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
												onclick={() => setScore(cat.id, opt.id, star)}
											>
												★
											</button>
										{/each}
										<span class="star-num">{currentRating}/5</span>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					<div class="space-v"></div>

					<div class="wizard-nav-row">
						<button class="btn" onclick={prevStep}>← PREVIOUS</button>
						<button class="btn btn-primary" onclick={proceedToNextStep}>
							{currentStep < totalCategories ? 'NEXT CATEGORY →' : 'REVIEW BALLOT →'}
						</button>
					</div>
				</div>
			{/if}

			<!-- FINAL STEP: REVIEW & SUBMIT -->
			{#if currentStep === totalSteps}
				<div class="empire-panel wizard-step-card">
					<div class="panel-tag">[ FINAL STEP: REVIEW & CONFIRM ]</div>
					<h2>CONFIRM YOUR BALLOT</h2>
					<p class="subtext">Review voter details before final submission.</p>
					<div class="space-v"></div>

					<div class="review-box">
						<div class="review-row">
							<span class="lbl">VOTER NAME:</span>
							<strong>{nickname}</strong>
						</div>
						<div class="review-row">
							<span class="lbl">CATEGORIES VOTED:</span>
							<strong>{totalCategories} Categories Completed</strong>
						</div>
					</div>

					<div class="space-v"></div>

					<div class="wizard-nav-row">
						<button class="btn" onclick={prevStep}>← BACK</button>
						<button class="btn btn-primary flex-1" disabled={submitting} onclick={handleSubmit}>
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
		max-width: 540px;
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

	.step-progress-bar {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--accent-cyan);
		letter-spacing: 0.12em;
		text-align: center;
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
		border: var(--border-subtle);
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

	.rcv-list, .options-column, .score-column {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.rcv-card {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 16px;
		background: var(--bg-panel-elevated);
		border: var(--border-subtle);
	}

	.rank-num {
		width: 36px;
		height: 36px;
		background: var(--accent-cyan);
		color: #000000;
		font-weight: 800;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-mono);
	}

	.rcv-info {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.opt-desc {
		font-size: 0.85rem;
		color: var(--text-dim);
	}

	.rcv-buttons {
		display: flex;
		gap: 6px;
	}

	.btn-order {
		padding: 8px 12px;
		background: var(--bg-space);
		border: 1px solid var(--text-secondary);
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 700;
		cursor: pointer;
	}

	.btn-order:disabled {
		opacity: 0.2;
		cursor: not-allowed;
	}

	.opt-btn-card {
		display: flex;
		align-items: center;
		padding: 16px 20px;
		background: var(--bg-panel-elevated);
		border: var(--border-subtle);
		color: var(--text-primary);
		text-align: left;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.opt-active {
		border: 2px solid #ffffff;
		background: rgba(255, 255, 255, 0.12);
		box-shadow: 4px 4px 0px var(--accent-cyan);
	}

	.opt-content {
		display: flex;
		flex-direction: column;
	}

	.score-item-box {
		padding: 16px;
		background: var(--bg-panel-elevated);
		border: var(--border-subtle);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.star-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.star-tap {
		background: none;
		border: none;
		font-size: 1.8rem;
		color: var(--text-dim);
		cursor: pointer;
	}

	.star-gold {
		color: var(--accent-cyan);
	}

	.star-num {
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: 1rem;
		color: var(--accent-cyan);
		margin-left: 8px;
	}

	.center-card {
		padding: 48px 24px;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
	}

	.subtext {
		color: var(--text-dim);
		font-size: 0.9rem;
	}

	.alert {
		padding: 14px 20px;
		font-family: var(--font-mono);
		font-weight: 700;
		border: 2px solid #ffffff;
	}

	.alert-error {
		background: var(--accent-red);
		color: #ffffff;
		border-color: var(--accent-red);
	}
</style>
