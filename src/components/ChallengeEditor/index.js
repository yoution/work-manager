import _ from 'lodash'
import * as queryString from 'query-string'
import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Helmet } from 'react-helmet'
import cn from 'classnames'
import moment from 'moment'
import { pick } from 'lodash/fp'
// import Modal from '../Modal'
import { withRouter } from 'react-router-dom'
import { toastr } from 'react-redux-toastr'
import xss from 'xss'

import {
  VALIDATION_VALUE_TYPE,
  PRIZE_SETS_TYPE,
  DEFAULT_TERM_UUID,
  DEFAULT_NDA_UUID,
  SUBMITTER_ROLE_UUID
} from '../../config/constants'
import { PrimaryButton, OutlineButton } from '../Buttons'
import TrackField from './Track-Field'
import TypeField from './Type-Field'
import ChallengeNameField from './ChallengeName-Field'
import CopilotField from './Copilot-Field'
import ReviewTypeField from './ReviewType-Field'
import TermsField from './Terms-Field'
import NDAField from './NDAField'
import GroupsField from './Groups-Field'
import CopilotFeeField from './CopilotFee-Field'
import ChallengeTotalField from './ChallengeTotal-Field'
import ChallengePrizesField from './ChallengePrizes-Field'
import AttachmentField from './Attachment-Field'
import TextEditorField from './TextEditor-Field'
import Loader from '../Loader'
import ChallengeScheduleField from './ChallengeSchedule-Field'
import { convertDollarToInteger, validateValue } from '../../util/input-check'
import dropdowns from './mock-data/dropdowns'
import LastSavedDisplay from './LastSaved-Display'
import styles from './ChallengeEditor.module.scss'
import Track from '../Track'
import {
  createChallenge,
  updateChallenge,
  createResource,
  deleteResource,
  patchChallenge
} from '../../services/challenges'
import ConfirmationModal from '../Modal/ConfirmationModal'
import AlertModal from '../Modal/AlertModal'
import PhaseInput from '../PhaseInput'

const theme = {
  container: styles.modalContainer
}

const getTitle = (isNew) => {
  if (isNew) {
    return 'Create New Work'
  }

  return 'Set-Up Work'
}

class ChallengeEditor extends Component {
  constructor (props) {
    super(props)
    this.state = {
      isLaunch: false,
      isConfirm: false,
      isClose: false,
      isOpenAdvanceSettings: false,
      isLoading: false,
      isSaving: false,
      hasValidationErrors: false,
      challenge: {
        ...dropdowns['newChallenge']
      },
      draftChallenge: { data: { id: null } },
      timeLastSaved: moment().format('MMMM Do YYYY, h:mm:ss a'),
      currentTemplate: null
    }
    this.onUpdateInput = this.onUpdateInput.bind(this)
    this.onUpdateSelect = this.onUpdateSelect.bind(this)
    this.onUpdateOthers = this.onUpdateOthers.bind(this)
    this.onUpdateCheckbox = this.onUpdateCheckbox.bind(this)
    this.addFileType = this.addFileType.bind(this)
    this.toggleAdvanceSettings = this.toggleAdvanceSettings.bind(this)
    this.toggleNdaRequire = this.toggleNdaRequire.bind(this)
    this.removeAttachment = this.removeAttachment.bind(this)
    this.removePhase = this.removePhase.bind(this)
    this.resetPhase = this.resetPhase.bind(this)
    this.savePhases = this.savePhases.bind(this)
    this.toggleLaunch = this.toggleLaunch.bind(this)
    this.onUpdateMultiSelect = this.onUpdateMultiSelect.bind(this)
    this.onUpdatePhase = this.onUpdatePhase.bind(this)
    this.resetChallengeData = this.resetChallengeData.bind(this)
    this.onUpdateDescription = this.onUpdateDescription.bind(this)
    this.onActiveChallenge = this.onActiveChallenge.bind(this)
    this.resetModal = this.resetModal.bind(this)
    this.createNewChallenge = this.createNewChallenge.bind(this)
    this.getCurrentChallengeId = this.getCurrentChallengeId.bind(this)
    this.isValidChallengePrizes = this.isValidChallengePrizes.bind(this)
    this.isValidChallenge = this.isValidChallenge.bind(this)
    this.createChallengeHandler = this.createChallengeHandler.bind(this)
    this.createDraftHandler = this.createDraftHandler.bind(this)
    this.onSaveChallenge = this.onSaveChallenge.bind(this)
    this.getCurrentTemplate = this.getCurrentTemplate.bind(this)
    this.onUpdateMetadata = this.onUpdateMetadata.bind(this)
    this.getTemplatePhases = this.getTemplatePhases.bind(this)
    this.getAvailableTimelineTemplates = this.getAvailableTimelineTemplates.bind(this)
    this.autoUpdateChallengeThrottled = _.throttle(this.autoUpdateChallenge.bind(this), 3000) // 3s
    this.resetChallengeData((newState, finish) => {
      this.state = {
        ...this.state,
        ...newState
      }
      if (finish) {
        finish()
      }
    })
  }

  componentDidUpdate () {
    this.resetChallengeData(this.setState.bind(this))
  }

  async resetChallengeData (setState = () => {}) {
    const { isNew, challengeDetails, metadata, attachments, challengeId } = this.props
    if (
      challengeDetails &&
      challengeDetails.id &&
      challengeId === challengeDetails.id &&
      (!this.state.challenge || this.state.challenge.id !== challengeDetails.id) &&
      !isNew
    ) {
      try {
        const copilotResource = this.getResourceFromProps('Copilot')
        const copilotFromResources = copilotResource ? copilotResource.memberHandle : ''
        const reviewerResource = this.getResourceFromProps('Reviewer')
        const reviewerFromResources = reviewerResource ? reviewerResource.memberHandle : ''
        setState({ isConfirm: false, isLaunch: false })
        const challengeData = this.updateAttachmentlist(challengeDetails, attachments)
        const currentTemplate = _.find(metadata.timelineTemplates, { id: challengeData.timelineTemplateId })
        let copilot, reviewer
        const challenge = this.state.challenge
        if (challenge) {
          copilot = challenge.copilot
          reviewer = challenge.reviewer
        }
        challengeData.copilot = copilot || copilotFromResources
        challengeData.reviewer = reviewer || reviewerFromResources
        const challengeDetail = { ...dropdowns['newChallenge'], ...challengeData }
        const isOpenAdvanceSettings = challengeDetail.groups.length > 0
        setState({
          challenge: challengeDetail,
          draftChallenge: { data: {
            ..._.cloneDeep(challengeDetails),
            copilot: challengeData.copilot,
            reviewer: challengeData.reviewer
          } },
          isLoading: false,
          isOpenAdvanceSettings,
          currentTemplate
        }, () => {
          // set default phases
          if (!challengeDetail.phases || !challengeDetail.phases.length) {
            let defaultTemplate = currentTemplate
            if (!defaultTemplate) {
              defaultTemplate = _.find(metadata.timelineTemplates, { name: 'Standard Code' })
            }
            this.resetPhase(defaultTemplate)
          }

          // set default prize sets
          // if (!challengeDetail.prizeSets || !challengeDetail.prizeSets.length) {
          //   this.onUpdateOthers({
          //     field: 'prizeSets',
          //     value: this.getDefaultPrizeSets()
          //   })
          // }
        })
      } catch (e) {
        setState({ isLoading: true })
      }
    }
  }

  resetModal () {
    this.setState({ isLoading: false, isConfirm: false, isLaunch: false, error: null })
  }

  onUpdateDescription (description, fieldName) {
    const { challenge: oldChallenge } = this.state
    const newChallenge = { ...oldChallenge, [fieldName]: description }
    this.setState({ challenge: newChallenge }, () => {
      this.autoUpdateChallengeThrottled(fieldName)
    })
  }

  /**
   * Update Input value of challenge
   * @param e The input event
   * @param isSub The value from sub field of challenge field
   * @param field The challenge field
   * @param index The index of array
   * @param valueType The value type. eg. number, integer, string
   */
  onUpdateInput (e, isSub = false, field = null, index = -1, valueType = null) {
    const { challenge: oldChallenge } = this.state
    const newChallenge = { ...oldChallenge }
    if (!isSub) {
      switch (e.target.name) {
        case 'reviewCost':
        case 'copilotFee':
          newChallenge[e.target.name] = validateValue(e.target.value, VALIDATION_VALUE_TYPE.INTEGER, '$')
          break
        default:
          newChallenge[e.target.name] = validateValue(e.target.value, VALIDATION_VALUE_TYPE.STRING)
          break
      }
    } else {
      switch (field) {
        case 'checkpointPrizes':
          switch (e.target.name) {
            case 'checkNumber':
              newChallenge[field][e.target.name] = validateValue(e.target.value, VALIDATION_VALUE_TYPE.INTEGER)
              break
            case 'checkAmount':
              newChallenge[field][e.target.name] = validateValue(e.target.value, VALIDATION_VALUE_TYPE.INTEGER, '$')
          }
          break
        case 'prizes':
          switch (valueType) {
            case VALIDATION_VALUE_TYPE.STRING:
              newChallenge[field][index]['amount'] = e.target.value.trim()
              newChallenge['focusIndex'] = index
              break
            case VALIDATION_VALUE_TYPE.INTEGER:
              newChallenge['focusIndex'] = index
              newChallenge[field][index]['amount'] = validateValue(e.target.value, VALIDATION_VALUE_TYPE.INTEGER)
          }
          break
        default:
          newChallenge[field][e.target.name] = e.target.value
          break
      }
    }

    // calculate total cost of challenge
    this.setState({ challenge: newChallenge })
  }

  /**
   * Update Single Select
   * @param option The select option
   * @param isSub The option from sub field
   * @param field The challenge field
   * @param index The index of array
   */
  onUpdateSelect (option, isSub = false, field = '', index = -1) {
    if (option) {
      const { challenge: oldChallenge } = this.state
      const newChallenge = { ...oldChallenge }
      if (!isSub) {
        newChallenge[field] = option
      } else {
        if (index < 0) {
          newChallenge[field][option.key] = option.name
        } else {
          newChallenge[field][index][option.key] = option.name
        }
      }
      this.setState({ challenge: newChallenge })
    }
  }

  /**
   * Update other fields of challenge
   * @param data
   */
  onUpdateOthers (data) {
    const { challenge: oldChallenge } = this.state
    const newChallenge = { ...oldChallenge }
    let { value, field } = data
    if (field === 'copilot' && value === newChallenge[field]) {
      value = null
    }
    if (field === 'prizeSets') {
      value = value.filter(val => _.values(PRIZE_SETS_TYPE).includes(val.type))
    }
    newChallenge[field] = value
    this.setState({ challenge: newChallenge })
  }

  /**
   * Update Checkbox
   * @param id The checkbox id
   * @param checked The check status
   * @param field The challenge field
   * @param index The index of array
   * @param isSingleCheck Allow check only one
   */
  onUpdateCheckbox (id, checked, field = '', index = -1, isSingleCheck = false) {
    const { challenge: oldChallenge } = this.state
    const newChallenge = { ...oldChallenge }
    if (field === 'reviewType' && !checked) {
      return
    }
    if (index < 0) {
      if (!_.isEmpty(field)) {
        if (isSingleCheck) {
          _.set(newChallenge, `${field}.${id}`, checked)
        } else {
          if (field !== 'terms') {
            for (let key in newChallenge[field]) {
              if (typeof key === 'boolean') {
                _.set(newChallenge, `${field}.${key}`, false)
              } else {
                _.set(newChallenge, `${field}.${key}`, '')
              }
            }
          }
          _.set(newChallenge, `${field}.${id}`, checked)
        }
      }
      newChallenge[id] = checked
    } else {
      _.set(newChallenge, `${field}.${index}.check`, checked)
    }
    this.setState({ challenge: newChallenge })
  }

  /**
   * Add new file type
   * @param {String} newFileType The new file type
   */
  addFileType (newFileType) {
    const { challenge: oldChallenge } = this.state
    const newChallenge = { ...oldChallenge }
    if (!_.isArray(newChallenge.fileTypes)) {
      newChallenge.fileTypes = []
    }
    newChallenge.fileTypes.push({ name: newFileType, check: false })
    this.setState({ challenge: newChallenge })
  }

  /**
   * Update Metadata
   * @param name Name of data
   * @param value The value
   * @param path Path of value
   */
  onUpdateMetadata (name, value, path) {
    const { challenge: oldChallenge } = this.state
    const newChallenge = { ...oldChallenge }
    if (!newChallenge.metadata) {
      newChallenge.metadata = []
    }
    let existingMetadata = _.find(newChallenge.metadata, { name })
    if (!existingMetadata) {
      existingMetadata = { name }
      newChallenge.metadata.push(existingMetadata)
      if (name === 'submissionLimit') {
        existingMetadata.value = '{}'
      }
    }
    if (existingMetadata.name === 'submissionLimit') {
      const submissionLimit = JSON.parse(existingMetadata.value)
      _.forOwn(submissionLimit, (value, key) => {
        if (value === 'true') {
          submissionLimit[key] = 'false'
        }
      })
      submissionLimit[path] = `${value}`
      if (path === 'count') {
        submissionLimit.limit = 'true'
        submissionLimit.unlimited = 'false'
      } else if (path === 'unlimited' && value) {
        submissionLimit.limit = 'false'
        submissionLimit.count = ''
      }
      existingMetadata.value = JSON.stringify(submissionLimit)
    } else {
      existingMetadata.value = `${value}`
    }
    this.setState({ challenge: newChallenge })
  }

  toggleAdvanceSettings () {
    const { isOpenAdvanceSettings } = this.state
    this.setState({ isOpenAdvanceSettings: !isOpenAdvanceSettings })
  }

  toggleNdaRequire () {
    const { challenge } = this.state
    const newChallenge = { ...challenge }
    let { terms: oldTerms } = challenge
    if (!oldTerms) {
      oldTerms = []
    }
    let newTerms = []
    if (_.some(oldTerms, { id: DEFAULT_NDA_UUID })) {
      newTerms = _.remove(oldTerms, t => t.id !== DEFAULT_NDA_UUID)
    } else {
      oldTerms.push({ id: DEFAULT_NDA_UUID, roleId: SUBMITTER_ROLE_UUID })
      newTerms = oldTerms
    }
    if (!_.some(newTerms, { id: DEFAULT_TERM_UUID })) {
      newTerms.push({ id: DEFAULT_TERM_UUID, roleId: SUBMITTER_ROLE_UUID })
    }
    newChallenge.terms = newTerms
    this.setState({ challenge: newChallenge })
  }

  removeAttachment (file) {
    const { challenge } = this.state
    const newChallenge = { ...challenge }
    const { attachments: oldAttachments } = challenge
    const newAttachments = _.remove(oldAttachments, att => att.fileName !== file)
    newChallenge.attachments = _.clone(newAttachments)
    this.setState({ challenge: newChallenge })
  }

  /**
   * Remove Phase from challenge Phases list
   * @param index
   */
  removePhase (index) {
    const { challenge: oldChallenge } = this.state
    const newChallenge = { ...oldChallenge }
    const newPhaseList = _.cloneDeep(oldChallenge.phases)
    newPhaseList.splice(index, 1)
    newChallenge.phases = _.clone(newPhaseList)
    this.setState({ challenge: newChallenge })
  }

  /**
   * Save updated  challenge Phases
   */
  async savePhases () {
    await this.autoUpdateChallengeThrottled('phases')
    this.setState({
      isConfirm: true,
      isLaunch: true
    })
  }

  /**
   * Reset  challenge Phases
   */
  async resetPhase (timeline) {
    const { challenge: oldChallenge } = this.state
    const newChallenge = { ...oldChallenge }
    newChallenge.phases = []
    this.setState({
      currentTemplate: timeline,
      challenge: newChallenge
    }, () => {
      this.autoUpdateChallengeThrottled('reset-phases')
    })
  }

  toggleLaunch (e) {
    e.preventDefault()
    if (this.validateChallenge()) {
      this.setState({ isLaunch: true })
    }
  }

  createDraftHandler () {
    if (this.validateChallenge()) {
      this.saveDraft()
    }
  }

  createChallengeHandler (e) {
    e.preventDefault()
    if (this.validateChallenge()) {
      this.createNewChallenge()
    }
  }

  onSaveChallenge (e) {
    e.preventDefault()
    if (this.validateChallenge()) {
      this.onlySave()
    }
  }

  isValidChallengePrizes () {
    const challengePrizes = this.state.challenge.prizeSets.find(p => p.type === PRIZE_SETS_TYPE.CHALLENGE_PRIZES)
    if (challengePrizes.prizes.length === 0) {
      return false
    }

    return _.every(challengePrizes.prizes, (prize) => {
      if (prize.value === '') {
        return false
      }
      const prizeNumber = parseInt(prize.value)
      if (prizeNumber > 1000000) {
        return false
      }
      return true
    })
  }

  isValidChallenge () {
    const { challenge } = this.state
    if (this.props.isNew) {
      const { name, trackId, typeId } = challenge
      return !!name && !!trackId && !!typeId
    }

    const reviewType = challenge.reviewType ? challenge.reviewType.toLowerCase() : 'community'
    const isInternal = reviewType === 'internal'
    if (isInternal && !challenge.reviewer) {
      return false
    }

    if (!this.isValidChallengePrizes()) {
      return false
    }

    return !(Object.values(pick([
      'trackId',
      'typeId',
      'name',
      'description',
      'tags',
      'prizeSets'
    ], challenge)).filter(v => !v.length).length ||
      _.isEmpty(this.state.currentTemplate))
  }

  validateChallenge () {
    if (this.isValidChallenge()) {
      this.setState({ hasValidationErrors: false })
      return true
    }
    this.setState(prevState => ({
      ...prevState,
      challenge: {
        ...prevState.challenge,
        submitTriggered: true
      }
    }))
    this.setState({ hasValidationErrors: true })
    return false
  }

  /**
   * Update Multi Select
   * @param options The option of select
   * @param field The challenge field
   */
  onUpdateMultiSelect (options, field) {
    const { challenge } = this.state
    let newChallenge = { ...challenge }
    newChallenge[field] = options ? options.split(',') : []

    this.setState({ challenge: newChallenge })
  }

  onUpdatePhase (newValue, property, index) {
    if (property === 'duration' && (newValue | 0) <= 0) return
    let newChallenge = _.cloneDeep(this.state.challenge)
    newChallenge.phases[index][property] = newValue
    this.setState({ challenge: newChallenge })
  }

  onUploadFile (files) {
    const { challenge: oldChallenge } = this.state
    const newChallenge = { ...oldChallenge }
    _.forEach(files, (file) => {
      newChallenge.attachments.push({
        fileName: file.name,
        size: file.size
      })
    })
    this.setState({ challenge: newChallenge })
  }

  collectChallengeData (status) {
    const { attachments } = this.props
    const challenge = pick([
      'phases',
      'typeId',
      'trackId',
      'name',
      'description',
      'privateDescription',
      'reviewType',
      'tags',
      'groups',
      'metadata',
      'startDate',
      'terms',
      'prizeSets'
    ], this.state.challenge)
    challenge.legacy = _.assign(this.state.challenge.legacy, {
      reviewType: challenge.reviewType
    })
    challenge.timelineTemplateId = _.get(this.getCurrentTemplate(), 'id')
    challenge.projectId = this.props.projectId
    challenge.prizeSets = challenge.prizeSets.map(p => {
      const prizes = p.prizes.map(s => ({ ...s, value: convertDollarToInteger(s.value, '$') }))
      return { ...p, prizes }
    })
    challenge.status = status
    if (this.state.challenge.id) {
      challenge.attachmentIds = _.map(attachments, item => item.id)
    }
    challenge.phases = challenge.phases.map((p) => pick([
      'duration',
      'phaseId'
    ], p))
    if (challenge.terms && challenge.terms.length === 0) delete challenge.terms
    delete challenge.attachments
    delete challenge.reviewType
    return _.cloneDeep(challenge)
  }

  goToEdit (challengeID) {
    const { history } = this.props
    const newPath = history.location.pathname.replace('/new', `/${challengeID}`) + '/edit'
    history.push(newPath)
  };

  async createNewChallenge () {
    if (!this.props.isNew) return
    const { metadata } = this.props
    const { name, trackId, typeId } = this.state.challenge
    const { timelineTemplates } = metadata

    // fallback template
    const STD_DEV_TIMELINE_TEMPLATE = _.find(timelineTemplates, { name: 'Standard Development' })
    const avlTemplates = this.getAvailableTimelineTemplates()
    // chooses first available timeline template or fallback template for the new challenge
    const defaultTemplate = avlTemplates && avlTemplates.length > 0 ? avlTemplates[0] : STD_DEV_TIMELINE_TEMPLATE

    const newChallenge = {
      status: 'New',
      projectId: this.props.projectId,
      name,
      typeId,
      trackId,
      startDate: moment().add(1, 'days').format(),
      legacy: {
        reviewType: 'community'
      },
      descriptionFormat: 'markdown',
      timelineTemplateId: defaultTemplate.id,
      terms: [{ id: DEFAULT_TERM_UUID, roleId: SUBMITTER_ROLE_UUID }],
      phases: this.getTemplatePhases(defaultTemplate)
      // prizeSets: this.getDefaultPrizeSets()
    }
    try {
      const draftChallenge = await createChallenge(newChallenge)
      this.goToEdit(draftChallenge.data.id)
      this.setState({ isSaving: false, draftChallenge })
    } catch (e) {
      this.setState({ isSaving: false })
    }
  }

  getTemplatePhases (template) {
    const timelinePhaseIds = template.phases.map(timelinePhase => timelinePhase.phaseId || timelinePhase)
    const validPhases = _.cloneDeep(this.props.metadata.challengePhases).filter(challengePhase => {
      return timelinePhaseIds.includes(challengePhase.id)
    })
    validPhases.forEach(phase => {
      delete Object.assign(phase, { phaseId: phase.id }).id
    })
    return validPhases.map(p => ({
      duration: p.duration,
      phaseId: p.phaseId
    }))
  }

  // getDefaultPrizeSets () {
  //   return [
  //     {
  //       type: PRIZE_SETS_TYPE.CHALLENGE_PRIZES,
  //       prizes: [{ type: 'money', value: '0' }]
  //     }
  //   ]
  // }

  async autoUpdateChallenge (changedField, prevValue) {
    if (this.state.isSaving || this.state.isLoading || !this.getCurrentChallengeId()) return
    const challengeId = this.state.draftChallenge.data.id || this.props.challengeId
    if (_.includes(['copilot', 'reviewer'], changedField)) {
      switch (changedField) {
        case 'copilot':
          await this.updateResource(challengeId, 'Copilot', this.state.challenge.copilot, prevValue)
          break
        case 'reviewer':
          await this.updateResource(challengeId, 'Reviewer', this.state.challenge.reviewer, prevValue)
          break
      }
    } else {
      let patchObject = (changedField === 'reviewType')
        ? { legacy: { reviewType: this.state.challenge[changedField] } } // NOTE it assumes challenge API PATCH respects the changes in legacy JSON
        : { [changedField]: this.state.challenge[changedField] }
      if (changedField === 'phases' || changedField === 'reset-phases') {
        const { currentTemplate } = this.state
        // need timelineTemplateId for updating phase
        patchObject.timelineTemplateId = currentTemplate ? currentTemplate.id : this.state.challenge.timelineTemplateId
      }

      if (changedField === 'reset-phases') {
        delete patchObject['reset-phases']
        const { currentTemplate } = this.state
        patchObject.phases = this.getTemplatePhases(currentTemplate)
      }
      if (changedField === 'prizeSets' && !this.isValidChallengePrizes()) {
        return
      }
      try {
        const copilot = this.state.draftChallenge.data.copilot
        const reviewer = this.state.draftChallenge.data.reviewer
        const draftChallenge = await patchChallenge(challengeId, patchObject)
        draftChallenge.copilot = copilot
        draftChallenge.reviewer = reviewer
        const { challenge: oldChallenge } = this.state
        const newChallenge = { ...oldChallenge }

        if (changedField === 'reset-phases') {
          const { currentTemplate } = this.state
          newChallenge.timelineTemplateId = currentTemplate.id
          newChallenge.phases = _.cloneDeep(draftChallenge.data.phases)
          this.setState({
            draftChallenge,
            challenge: newChallenge })
        } else {
          this.setState({ draftChallenge })
        }
        this.updateTimeLastSaved()
      } catch (error) {
        if (changedField === 'groups') {
          toastr.error('Error', `You don't have access to the ${patchObject.groups[0]} group`)
          const newGroups = this.state.challenge.groups.filter(group => group !== patchObject.groups[0])
          this.setState({ challenge: { ...this.state.challenge, groups: newGroups } })
        }
      }
    }
  }

  getCurrentChallengeId () {
    let { challengeId } = this.props
    if (!challengeId) {
      challengeId = this.state.draftChallenge.data.id
    }
    if (!challengeId) {
      const { history } = this.props
      const queryParams = queryString.parse(history.location.search)
      challengeId = queryParams.challengeId
    }
    return challengeId
  }

  async updateAllChallengeInfo (status, cb = () => {}) {
    if (this.state.isSaving) return
    this.setState({ isSaving: true })
    const challenge = this.collectChallengeData(status)
    let newChallenge = _.cloneDeep(this.state.challenge)
    newChallenge.status = status
    try {
      const challengeId = this.getCurrentChallengeId()
      const response = await updateChallenge(challenge, challengeId)
      const { copilot: previousCopilot, reviewer: previousReviewer } = this.state.draftChallenge.data
      const { copilot, reviewer } = this.state.challenge
      if (copilot) await this.updateResource(response.data.id, 'Copilot', copilot, previousCopilot)
      if (reviewer) await this.updateResource(response.data.id, 'Reviewer', reviewer, previousReviewer)
      this.updateTimeLastSaved()

      const draftChallenge = response
      draftChallenge.data.copilot = copilot
      draftChallenge.data.reviewer = reviewer
      this.setState({ isLaunch: true,
        isConfirm: newChallenge.id,
        draftChallenge,
        challenge: newChallenge,
        isSaving: false }, cb)
    } catch (e) {
      const error = _.get(e, 'response.data.message', `Unable to update the challenge to status ${status}`)
      this.setState({ isSaving: false, error }, cb)
    }
  }

  async onActiveChallenge () {
    this.updateAllChallengeInfo('Active')
  }

  async saveDraft () {
    this.updateAllChallengeInfo('Draft')
  }

  async onlySave () {
    this.updateAllChallengeInfo(this.state.challenge.status, () => {
      this.resetModal()
      const { history } = this.props
      history.push('./view')
    })
  }

  updateTimeLastSaved () {
    this.setState({ timeLastSaved: moment().format('MMMM Do YYYY, h:mm:ss a') })
  }

  getResourceRoleByName (name) {
    const { resourceRoles } = this.props.metadata
    return resourceRoles ? resourceRoles.find(role => role.name === name) : null
  }

  async updateResource (challengeId, name, value, prevValue) {
    const resourceRole = this.getResourceRoleByName(name)
    if (value === prevValue) {
      return
    }
    const newResource = {
      challengeId,
      memberHandle: value,
      roleId: resourceRole ? resourceRole.id : null
    }
    if (prevValue) {
      const oldResource = _.pick(newResource, ['challengeId', 'roleId'])
      oldResource.memberHandle = prevValue
      await deleteResource(oldResource)
    }

    await createResource(newResource)
    this.updateTimeLastSaved()
  }

  updateAttachmentlist (challenge, attachments) {
    const newChallenge = _.cloneDeep(challenge)
    if (attachments.length > 0) {
      if (!_.has(challenge, 'attachments')) {
        newChallenge.attachments = []
      }

      newChallenge.attachments = _.cloneDeep(attachments)
    } else {
      newChallenge.attachments = []
    }

    return newChallenge
  }

  getResourceFromProps (name) {
    const { challengeResources } = this.props
    const role = this.getResourceRoleByName(name)
    return challengeResources && role && challengeResources.find(resource => resource.roleId === role.id)
  }

  getCurrentTemplate () {
    const { currentTemplate, challenge } = this.state
    if (currentTemplate) {
      return currentTemplate
    }
    const { metadata } = this.props
    if (!challenge) {
      return null
    }
    return _.find(metadata.timelineTemplates, { id: challenge.timelineTemplateId })
  }

  /**
   * Filters the available timeline templates based on the challenge type
   */
  getAvailableTimelineTemplates () {
    const { challenge } = this.state
    const { metadata } = this.props
    const { challengeTimelines, timelineTemplates } = metadata

    // all timeline template ids available for the challenge type
    const availableTemplateIds = _.filter(challengeTimelines, tt => tt.typeId === challenge.typeId).map(tt => tt.timelineTemplateId)
    // filter and return timeline templates that are available for this challenge type
    return _.filter(timelineTemplates, tt => availableTemplateIds.indexOf(tt.id) !== -1)
  }

  render () {
    const { isLaunch, isConfirm, challenge, isOpenAdvanceSettings, timeLastSaved, isSaving } = this.state
    const {
      isNew,
      isLoading,
      metadata,
      uploadAttachment,
      token,
      removeAttachment,
      failedToLoad,
      projectDetail
    } = this.props
    if (_.isEmpty(challenge)) {
      return <div>Error loading challenge</div>
    }
    let isActive = false
    let isCompleted = false
    if (challenge.status) {
      isActive = challenge.status.toLowerCase() === 'active'
      isCompleted = challenge.status.toLowerCase() === 'completed'
    }
    if (isLoading || _.isEmpty(metadata.challengePhases)) return <Loader />
    if (failedToLoad) {
      return (
        <div className={styles.wrapper}>
          <div className={styles.title}>There was an error loading the challenge</div>
          <br />
          <div className={styles.container}>
            <div className={styles.formContainer}>
              <div className={styles.group}>
                <div className={styles.row}>
                  <div className={styles.error}>
                    Please try again later and if the issue persists contact us at&nbsp;
                    <a href='mailto:support@topcoder.com'>support@topcoder.com</a>
                    &nbsp;to resolve the issue as soon as possible.
                  </div>
                  <br />
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    let activateModal = null
    let draftModal = null
    let savedModal = null

    let { type } = challenge
    if (!type) {
      const { typeId } = challenge
      if (typeId && metadata.challengeTypes) {
        const selectedType = _.find(metadata.challengeTypes, { id: typeId })
        if (selectedType) {
          type = selectedType.name
        }
      }
    }
    if (!isNew && challenge.status === 'New' && isLaunch && isConfirm) {
      savedModal = (
        <AlertModal
          title='Saved Challenge'
          message={`Challenge "${challenge.name}" is saved successfuly`}
          theme={theme}
          onCancel={this.resetModal}
          closeText='Close'
          okText='View Challenge'
          okLink='./view'
          onClose={this.resetModal}
        />
      )
    }

    if (!isNew && isLaunch && !isConfirm) {
      activateModal = (
        <ConfirmationModal
          title='Launch Challenge Confirmation'
          message={`Do you want to launch ${type} challenge "${challenge.name}"?`}
          theme={theme}
          isProcessing={this.state.isSaving}
          errorMessage={this.state.error}
          onCancel={this.resetModal}
          onConfirm={this.onActiveChallenge}
        />
      )
    }

    if (!isNew && challenge.status !== 'New' && isLaunch && isConfirm) {
      draftModal = (
        <AlertModal
          title='Success'
          message={
            challenge.status === 'Draft'
              ? 'Your challenge is saved as draft'
              : 'We have scheduled your challenge and processed the payment'
          }
          theme={theme}
          closeText='Close'
          closeLink='/'
          okText='View Challenge'
          okLink='./view'
          onClose={this.resetModal}
        />
      )
    }

    const actionButtons = <React.Fragment>
      {!isLoading && this.state.hasValidationErrors && <div className={styles.error}>Please fix the errors before saving</div>}
      {
        isNew && (
          <div className={styles.buttonContainer}>
            <div className={styles.button}>
              <OutlineButton text={'Continue Set-Up'} type={'success'} submit />
            </div>
          </div>
        )
      }
      {
        !isNew && (
          <div className={styles.bottomContainer}>
            {!isLoading && <LastSavedDisplay timeLastSaved={timeLastSaved} />}
            {!isLoading && (!isActive) && (!isCompleted) && <div className={styles.buttonContainer}>
              <div className={styles.button}>
                <OutlineButton text={'Save Draft'} type={'success'} onClick={this.createDraftHandler} />
              </div>
              <div className={styles.button}>
                <PrimaryButton text={'Launch as Active'} type={'info'} submit />
              </div>
            </div>}
            {!isLoading && isActive && <div className={styles.buttonContainer}>
              <div className={styles.button}>
                <OutlineButton text={isSaving ? 'Saving...' : 'Save'} type={'success'} onClick={this.onSaveChallenge} />
              </div>
            </div>}
          </div>
        )
      }
    </React.Fragment>
    const selectedType = _.find(metadata.challengeTypes, { id: challenge.typeId })
    const challengeTrack = _.find(metadata.challengeTracks, { id: challenge.trackId })
    const currentChallengeId = this.getCurrentChallengeId()
    const showTimeline = false // disables the timeline for time being https://github.com/topcoder-platform/challenge-engine-ui/issues/706
    const challengeForm = isNew
      ? (
        <form name='challenge-new-form' noValidate autoComplete='off' onSubmit={this.createChallengeHandler}>
          <div className={styles.newFormContainer}>
            <TrackField tracks={metadata.challengeTracks} challenge={challenge} onUpdateOthers={this.onUpdateOthers} />
            <TypeField types={metadata.challengeTypes} onUpdateSelect={this.onUpdateSelect} challenge={challenge} />
            <ChallengeNameField challenge={challenge} onUpdateInput={this.onUpdateInput} />
          </div>
          { actionButtons }
        </form>
      ) : (
        <form name='challenge-info-form' noValidate autoComplete='off' onSubmit={this.toggleLaunch}>
          <div className={styles.group}>

            <div className={cn(styles.row, styles.topRow)}>
              <div className={styles.col}>
                <span>
                  <span className={styles.fieldTitle}>Project:</span>
                  <span dangerouslySetInnerHTML={{
                    __html: xss(projectDetail ? projectDetail.name : '')
                  }} />
                </span>
              </div>
              <div className={styles.col}>
                <span className={styles.fieldTitle}>Track:</span>
                <Track disabled type={challengeTrack} isActive key={challenge.trackId} onUpdateOthers={() => {}} />
              </div>
              <div className={styles.col}>
                <span><span className={styles.fieldTitle}>Type:</span> {selectedType ? selectedType.name : ''}</span>
              </div>
              <div className={styles.col}>
                <span><span className={styles.fieldTitle}>Status:</span> {challenge.status}</span>
              </div>
            </div>
            <ChallengeNameField challenge={challenge} onUpdateInput={this.onUpdateInput} />
            <NDAField challenge={challenge} toggleNdaRequire={this.toggleNdaRequire} />
            <CopilotField challenge={challenge} copilots={metadata.members} onUpdateOthers={this.onUpdateOthers} />
            <ReviewTypeField
              reviewers={metadata.members}
              challenge={challenge}
              onUpdateOthers={this.onUpdateOthers}
              onUpdateSelect={this.onUpdateSelect}
            />
            <div className={styles.row}>
              <div className={styles.tcCheckbox}>
                <input
                  name='isOpenAdvanceSettings'
                  type='checkbox'
                  id='isOpenAdvanceSettings'
                  checked={isOpenAdvanceSettings}
                  onChange={this.toggleAdvanceSettings}
                />
                <label htmlFor='isOpenAdvanceSettings'>
                  <div>View Advanced Settings</div>
                  <input type='hidden' />
                </label>
              </div>
            </div>
            { isOpenAdvanceSettings && (
              <React.Fragment>
                {/* remove terms field and use default term */}
                {false && (<TermsField terms={metadata.challengeTerms} challenge={challenge} onUpdateMultiSelect={this.onUpdateMultiSelect} />)}
                <GroupsField groups={metadata.groups} onUpdateMultiSelect={this.onUpdateMultiSelect} challenge={challenge} />
              </React.Fragment>
            )}
            {
              <div className={styles.PhaseRow}>
                <PhaseInput
                  withDates
                  phase={{
                    name: 'Start Date',
                    date: challenge.startDate
                  }}
                  onUpdatePhase={newValue => this.onUpdateOthers({
                    field: 'startDate',
                    value: newValue.format()
                  })}
                  readOnly={false}
                />
              </div>
            }
            { showTimeline && (
              <ChallengeScheduleField
                templates={this.getAvailableTimelineTemplates()}
                challengePhases={metadata.challengePhases}
                removePhase={this.removePhase}
                resetPhase={this.resetPhase}
                savePhases={this.savePhases}
                challenge={challenge}
                onUpdateSelect={this.onUpdateSelect}
                onUpdatePhase={this.onUpdatePhase}
                onUpdateOthers={this.onUpdateOthers}
                currentTemplate={this.getCurrentTemplate()}
              />
            )}
          </div>
          <div className={styles.group}>
            <div className={styles.title}>Public specification <span>*</span></div>
            <TextEditorField
              challengeTags={metadata.challengeTags}
              challenge={challenge}
              onUpdateCheckbox={this.onUpdateCheckbox}
              addFileType={this.addFileType}
              onUpdateInput={this.onUpdateInput}
              onUpdateDescription={this.onUpdateDescription}
              onUpdateMultiSelect={this.onUpdateMultiSelect}
              onUpdateMetadata={this.onUpdateMetadata}
            />
            { false && (
              <AttachmentField
                challenge={{ ...challenge, id: currentChallengeId }}
                onUploadFile={uploadAttachment}
                token={token}
                removeAttachment={removeAttachment}
              />
            )}
            <ChallengePrizesField challenge={challenge} onUpdateOthers={this.onUpdateOthers} />
            <CopilotFeeField challenge={challenge} onUpdateOthers={this.onUpdateOthers} />
            <ChallengeTotalField challenge={challenge} />
            { this.state.hasValidationErrors && !this.isValidChallengePrizes() &&
              <div className={styles.error}>Prize amounts should be from 0 to 1000000</div> }
          </div>
          { actionButtons }
        </form>
      )

    return (
      <div className={styles.wrapper}>
        <Helmet title={getTitle(isNew)} />
        <div className={styles.title}>{getTitle(isNew)}</div>
        <div className={cn(styles.actionButtons, styles.button)}>
          <PrimaryButton text={'Back'} type={'info'} submit link={`/projects/${projectDetail.id}/challenges`} />
        </div>
        <div className={styles.textRequired}>* Required</div>
        <div className={styles.container}>
          { activateModal }
          { draftModal }
          { savedModal }
          <div className={styles.formContainer}>
            { challengeForm }
          </div>
        </div>
      </div>
    )
  }
}

ChallengeEditor.defaultProps = {
  challengeId: null,
  attachments: [],
  failedToLoad: false,
  challengeResources: {},
  projectDetail: {}
}

ChallengeEditor.propTypes = {
  challengeDetails: PropTypes.object,
  projectDetail: PropTypes.object,
  challengeResources: PropTypes.arrayOf(PropTypes.object),
  isNew: PropTypes.bool.isRequired,
  projectId: PropTypes.string.isRequired,
  challengeId: PropTypes.string,
  metadata: PropTypes.object.isRequired,
  isLoading: PropTypes.bool.isRequired,
  uploadAttachment: PropTypes.func.isRequired,
  removeAttachment: PropTypes.func.isRequired,
  attachments: PropTypes.arrayOf(PropTypes.shape()),
  token: PropTypes.string.isRequired,
  failedToLoad: PropTypes.bool,
  history: PropTypes.any.isRequired
}

export default withRouter(ChallengeEditor)
