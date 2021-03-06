import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { TAPi18n } from 'meteor/tap:i18n';
import { Session } from 'meteor/session';
import { Contracts } from '/imports/api/contracts/Contracts';
import { ReactiveVar } from 'meteor/reactive-var';

import { setVote, getTickValue, candidateBallot, getRightToVote, getBallot, setBallot } from '/imports/ui/modules/ballot';
import { Vote } from '/imports/ui/modules/Vote';
import './fork.html';

Template.fork.onCreated(() => {
  if (!Session.get('contract')) {
    Template.instance().contract = new ReactiveVar(Template.currentData().contract);
  } else {
    Template.instance().contract = new ReactiveVar(Contracts.findOne({ _id: Session.get('contract')._id }));
  }

  Template.instance().rightToVote = new ReactiveVar(getRightToVote(Template.instance().contract.get()));
  Template.instance().candidateBallot = new ReactiveVar(getBallot(Template.instance().contract.get()._id));
});

Template.fork.helpers({
  length() {
    if (this.label !== undefined) {
      if (this.label.length > 51) {
        return 'option-link option-long option-longest';
      } else if (this.label.length > 37) {
        return 'option-link option-long';
      }
    }
    return '';
  },
  dragMode() {
    if (Template.instance().contract.get().stage === 'DRAFT' || this.mini === true) {
      return '';
    }
    return 'vote-nondrag';
  },
  tickStyle() {
    if (this.mode === 'REJECT') {
      return 'unauthorized';
    }
    return '';
  },
  checkbox(mode) {
    switch (mode) {
      case 'AUTHORIZE':
        return 'vote-authorize nondraggable';
      case 'REJECT':
        return 'vote-authorize unauthorized nondraggable';
      case 'FORK':
      default:
        return 'vote vote-alternative';
    }
  },
  action() {
    if (this.authorized === false) {
      return 'undefined';
    }
    return '';
  },
  option(mode) {
    if (Template.instance().contract.get().stage === 'DRAFT' || (Template.instance().rightToVote.get() === false && Template.instance().contract.get().stage !== 'DRAFT')) {
      return 'disabled';
    }
    switch (mode) {
      case 'AUTHORIZE':
        return '';
      case 'REJECT':
        if (this.mini) {
          return 'unauthorized';
        }
        return 'option-link unauthorized';
      default:
        return '';
    }
  },
  decision(mode) {
    switch (mode) {
      case 'REJECT':
        return 'option-link unauthorized';
      default:
        return '';
    }
  },
  caption(mode) {
    if (mode !== 'FORK') {
      return TAPi18n.__(mode);
    }
    return this.label;
  },
  tick() {
    if (Template.instance().contract.get().stage === 'DRAFT') {
      return 'disabled';
    }
    return '';
  },
  tickStatus() {
    this.tick = getTickValue(Template.instance().contract.get()._id, this, Template.instance().contract);
    if (Template.instance().candidateBallot.get() || (this.tick)) {
      if (this.tick) {
        if (this.mode === 'REJECT') {
          return 'tick-active-unauthorized';
        }
        return 'tick-active';
      }
    // already voted
    } else if (Template.instance().rightToVote.get() === false && Template.instance().contract.get().stage !== 'DRAFT') {
      if (this.tick) {
        return 'tick-disabled';
      }
    }
    return '';
  },
  style(className) {
    let final = className;
    if (this.mini === true) {
      final += ` ${final}-mini`;
    }
    return final;
  },
  isReject() {
    return (this.mode === 'REJECT');
  },
});


Template.fork.events({
  'click #ballotCheckbox'() {
    if (!Session.get('showModal')) {
      switch (Template.instance().contract.get().stage) {
        case 'DRAFT':
        case 'FINISH':
          Session.set('disabledCheckboxes', true);
          break;
        case 'LIVE':
        default:
          if (Template.instance().rightToVote.get()) {
            if (Template.instance().candidateBallot.get().length === 0) {
              Template.instance().candidateBallot.set(candidateBallot(Meteor.userId(), Template.instance().contract.get()._id));
            }
            const previous = Template.instance().candidateBallot.get();
            console.log(this.voteId);
            const wallet = new Vote(Session.get(this.voteId), Session.get(this.voteId).targetId, this.voteId);
            wallet.inBallot = Session.get(this.voteId).inBallot;
            wallet.allocateQuantity = wallet.inBallot;
            wallet.allocatePercentage = parseFloat((wallet.inBallot * 100) / wallet.balance, 10).toFixed(2);
            const cancel = () => {
              // Session.set('candidateBallot', previous);
              Template.instance().candidateBallot.set(setBallot(Template.instance().contract.get()._id, previous));
            };
            this.tick = setVote(Template.instance().contract.get(), this);
            if (this.tick === true) {
              Session.set('noSelectedOption', false);
            }

            // TODO consider multiple choice use case!!
            // vote
            if (this.tick === false && Session.get(this.voteId).inBallot > 0) {
              // remove all votes
              wallet.allocatePercentage = 0;
              wallet.allocateQuantity = 0;
              wallet.execute(cancel, true);
              return;
            } else if (Session.get(this.voteId).inBallot > 0) {
              // send new ballot
              wallet.execute(cancel);
            }
            break;
          }
      }
    }
  },
  'click #remove-fork'() {
    Contracts.update(Template.instance().contract.get()._id, { $pull: {
      ballot:
        { _id: this._id },
    } });
  },
});
