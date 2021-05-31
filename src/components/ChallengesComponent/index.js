/**
 * Component to render Challenges page
 */
import React from 'react'
import PropTypes from 'prop-types'
import Sticky from 'react-stickynode'
import { Helmet } from 'react-helmet'
import { Link } from 'react-router-dom'
import { CONNECT_APP_URL, DIRECT_PROJECT_URL } from '../../config/constants'

import { PrimaryButton } from '../Buttons'
import ChallengeList from './ChallengeList'
import styles from './ChallengesComponent.module.scss'
import Loader from '../Loader'
import xss from 'xss'

const ChallengesComponent = ({
  challenges,
  isLoading,
  isBillingAccountLoading,
  isBillingAccountExpired,
  warnMessage,
  filterChallengeName,
  activeProject,
  status,
  loadChallengesByPage,
  activeProjectId,
  page,
  perPage,
  totalChallenges,
  partiallyUpdateChallengeDetails,
  deleteChallenge
}) => {
  return (
    <Sticky top={10}>
      <div>
        <Helmet title={activeProject ? activeProject.name : ''} />
        <div className={styles.titleContainer}>
          <div className={styles.titleLinks}>
            {activeProject && activeProject.id && (
              <a
                className={styles.buttonLaunchNew}
                href={`${CONNECT_APP_URL}/projects/${activeProject.id}`}
                target={'_blank'}
              >
                <PrimaryButton text={'View Project in Connect'} type={'info'} />
              </a>
            )}
            {activeProject && activeProject.directProjectId && (
              <a
                className={styles.buttonLaunchNew}
                href={`${DIRECT_PROJECT_URL}/projectOverview?formData.projectId=${activeProject.directProjectId}`}
                target={'_blank'}
              >
                <PrimaryButton text={'View Project in Direct'} type={'info'} />
              </a>
            )}
          </div>
          <div
            className={styles.title}
            dangerouslySetInnerHTML={{
              __html: xss(activeProject ? activeProject.name : '')
            }}
          />
          {(activeProject && activeProject.id) ? (
            <Link
              className={styles.buttonLaunchNew}
              to={isBillingAccountLoading || isBillingAccountExpired ? `/projects/${activeProject.id}/challenges` : `/projects/${activeProject.id}/challenges/new`}
            >
              <PrimaryButton disabled={isBillingAccountLoading || isBillingAccountExpired} text={'Launch New'} type={'info'} />
            </Link>
          ) : (
            <span />
          )}
        </div>
        <div className={styles.challenges}>
          {isLoading ? (
            <Loader />
          ) : (
            <ChallengeList
              challenges={challenges}
              warnMessage={warnMessage}
              activeProject={activeProject}
              filterChallengeName={filterChallengeName}
              status={status}
              loadChallengesByPage={loadChallengesByPage}
              activeProjectId={activeProjectId}
              page={page}
              perPage={perPage}
              totalChallenges={totalChallenges}
              partiallyUpdateChallengeDetails={partiallyUpdateChallengeDetails}
              deleteChallenge={deleteChallenge}
            />
          )}
        </div>
      </div>
    </Sticky>
  )
}

ChallengesComponent.propTypes = {
  challenges: PropTypes.arrayOf(PropTypes.object),
  activeProject: PropTypes.shape({
    id: PropTypes.number,
    name: PropTypes.string
  }),
  isLoading: PropTypes.bool,
  isBillingAccountExpired: PropTypes.bool,
  isBillingAccountLoading: PropTypes.bool,
  warnMessage: PropTypes.string,
  filterChallengeName: PropTypes.string,
  status: PropTypes.string,
  activeProjectId: PropTypes.number,
  loadChallengesByPage: PropTypes.func.isRequired,
  page: PropTypes.number.isRequired,
  perPage: PropTypes.number.isRequired,
  totalChallenges: PropTypes.number.isRequired,
  partiallyUpdateChallengeDetails: PropTypes.func.isRequired,
  deleteChallenge: PropTypes.func.isRequired
}

ChallengesComponent.defaultProps = {
  challenges: [],
  isLoading: true
}

export default ChallengesComponent
