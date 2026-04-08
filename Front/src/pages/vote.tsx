import { useState } from 'react';

function Vote() {
  const [votes, setVotes] = useState([
    {
      id: 1,
      title: "Création d'un jardin partagé",
      votesPour: 20,
      votesContre: 11,
      personalVote: false,
    },
    {
      id: 2,
      title: 'Parc pour les chiens',
      votesPour: 25,
      votesContre: 5,
      personalVote: false,
    },
    {
      id: 3,
      title: 'Mini ',
      votesPour: 10,
      votesContre: 20,
      personalVote: false,
    },
  ]);

  const votesEnCours = votes.length;
  const handleVote = (id: number, choice: 'pour' | 'contre') => {
    setVotes((prevVotes) =>
      prevVotes.map((vote) => {
        if (vote.id !== id || vote.personalVote) {
          return vote;
        }

        if (choice === 'pour') {
          return {
            id: vote.id,
            title: vote.title,
            votesContre: vote.votesContre,
            votesPour: vote.votesPour + 1,
            personalVote: true,
          };
        } else {
          return {
            id: vote.id,
            title: vote.title,
            votesPour: vote.votesPour,
            votesContre: vote.votesContre + 1,
            personalVote: true,
          };
        }
      }),
    );
  };

  return (
    <div className="h-20 w-full flex p-4">
      <div className="flex-1 flex flex-col px-4">
        <div className="shadow-lg w-full bg-white rounded-2xl mb-8 flex justify-between items-center px-10 py-6">
          <h1 className="text-4xl text-orange-1 font-semibold">Votes</h1>

          <div className="flex gap-8">
            <div className="text-center">
              <span className="block text-3xl font-bold text-blue-1">
                {votesEnCours}
              </span>
              <span className="text-sm font-medium uppercase tracking-wide">
                En cours
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {votes.map((vote) => {
            const totalVotes = vote.votesPour + vote.votesContre;
            let pourPourcentage = 0;
            let contrePourcentage = 0;

            if (totalVotes > 0) {
              pourPourcentage = Math.round((vote.votesPour / totalVotes) * 100);
              contrePourcentage = 100 - pourPourcentage;
            }
            return (
              <div
                key={vote.id}
                className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 flex flex-col gap-6"
              >
                <h2 className="text-2xl font-bold leading-tight min-h-[64px]">
                  {vote.title}
                </h2>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-[15px] font-bold px-1">
                    <span className="text-blue-1">{pourPourcentage}%</span>
                    <span className="text-orange-1">{contrePourcentage}%</span>
                  </div>

                  <div className="h-4 w-full bg-orange-1 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-1 transition-all duration-500"
                      style={{ width: pourPourcentage + '%' }}
                    ></div>
                  </div>
                </div>

                <div className="flex gap-4 w-full mt-2">
                  <button
                    onClick={() => handleVote(vote.id, 'pour')}
                    disabled={vote.personalVote}
                    className="flex-1 bg-blue-1 text-white text-[18px] font-bold py-3 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Pour
                  </button>
                  <button
                    onClick={() => handleVote(vote.id, 'contre')}
                    disabled={vote.personalVote}
                    className="flex-1 bg-transparent text-black text-xl font-bold py-3 rounded-full border-2 border-blue-1 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Contre
                  </button>
                </div>

                <div className="text-center mt-2">
                  <span className="text-lg font-medium text-black">
                    {totalVotes} votes
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Vote;
