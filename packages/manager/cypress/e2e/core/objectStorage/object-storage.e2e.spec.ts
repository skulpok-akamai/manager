/**
 * @file End-to-end tests for Object Storage operations.
 */

import { authenticate } from 'support/api/authentication';
import {
  interceptGetNetworkUtilization,
  mockGetAccount,
} from 'support/intercepts/account';
import { mockAppendFeatureFlags } from 'support/intercepts/feature-flags';
import {
  interceptDeleteBucket,
  interceptGetBucketAccess,
  interceptGetBuckets,
  interceptUpdateBucketAccess,
} from 'support/intercepts/object-storage';
import { ui } from 'support/ui';
import { cleanUp } from 'support/util/cleanup';
import { randomLabel } from 'support/util/random';
import { chooseRegion } from 'support/util/regions';

import { accountFactory } from 'src/factories';
import { createBucket, type ObjectStorageBucket } from '@linode/api-v4';

authenticate();
beforeEach(() => {
  cy.tag('method:e2e');
});
describe('object storage end-to-end tests', () => {
  before(() => {
    cleanUp('obj-buckets');
  });

  /*
   * - Tests object bucket creation flow using real API responses.
   * - Confirms that bucket can be created.
   * - Confirms new bucket is listed on landing page.
   * - Confirms that empty buckets can be deleted.
   * - Confirms that deleted buckets are no longer listed on landing page.
   */
  it('can delete object storage bucket', () => {
    cy.tag('purpose:syntheticTesting');
    const bucketLabel = randomLabel();
    const bucketRegion = chooseRegion({ capabilities: ['Object Storage'] });

    cy.defer(
      () =>
        createBucket({
          label: bucketLabel,
          region: bucketRegion.id,
        }),
      'creating Object Storage bucket'
    ).then((bucket: ObjectStorageBucket) => {
      interceptGetBuckets().as('getBuckets');
      interceptDeleteBucket(bucketLabel, bucketRegion.id).as('deleteBucket');
      interceptGetNetworkUtilization().as('getNetworkUtilization');

      mockGetAccount(
        accountFactory.build({ capabilities: ['Object Storage'] })
      );
      mockAppendFeatureFlags({
        objMultiCluster: true,
        objectStorageGen2: { enabled: true },
      }).as('getFeatureFlags');

      cy.visitWithLogin('/object-storage/buckets');
      cy.wait(['@getFeatureFlags', '@getBuckets', '@getNetworkUtilization']);

      // Wait for loader to disappear, indicating that all buckets have been loaded.
      // Mitigates test failures stemming from M3-7833.
      cy.findByTestId('Buckets').within(() => {
        cy.findByLabelText('Content is loading').should('not.exist');
      });

      // Confirm that bucket is created, initiate deletion.
      cy.findByText(bucketLabel)
        .should('be.visible')
        .closest('tr')
        .within(() => {
          cy.findByText(bucketRegion.label).should('be.visible');
          cy.findByText(bucket.hostname).should('be.visible');
          ui.button.findByTitle('Delete').should('be.visible').click();
        });

      ui.dialog
        .findByTitle(`Delete Bucket ${bucketLabel}`)
        .should('be.visible')
        .within(() => {
          cy.findByLabelText('Bucket Name').click();
          cy.focused().type(bucketLabel);
          ui.buttonGroup
            .findButtonByTitle('Delete')
            .should('be.visible')
            .should('be.enabled')
            .click();
        });

      // Confirm that deletion succeeds.
      cy.wait('@deleteBucket').its('response.statusCode').should('eq', 200);
      cy.findByText(bucketLabel).should('not.exist');
    });
  });

  /*
   * - Confirms that user can update Bucket access.
   * - Confirms user can switch bucket access from Private to Public Read.
   * - Confirms that toast notification appears confirming operation.
   */
  it('can update bucket access', () => {
    const bucketLabel = randomLabel();
    const region = chooseRegion({ capabilities: ['Object Storage'] });
    const bucketAccessPage = `/object-storage/buckets/${region.id}/${bucketLabel}/access`;

    cy.defer(
      () =>
        createBucket({
          label: bucketLabel,
          region: region.id,
        }),
      'creating Object Storage bucket'
    ).then(() => {
      interceptGetBucketAccess(bucketLabel, region.id).as('getBucketAccess');
      interceptUpdateBucketAccess(bucketLabel, region.id).as(
        'updateBucketAccess'
      );

      // Navigate to new bucket page, upload and delete an object.
      cy.visitWithLogin(bucketAccessPage);

      cy.wait('@getBucketAccess');

      // Make object public, confirm it can be accessed.
      cy.findByLabelText('Access Control List (ACL)')
        .should('be.visible')
        .should('not.have.value', 'Loading access...')
        .should('have.value', 'Private')
        .click();
      cy.focused().type('Public Read');

      ui.autocompletePopper
        .findByTitle('Public Read')
        .should('be.visible')
        .click();

      ui.button.findByTitle('Save').should('be.visible').click();

      // TODO Confirm that outgoing API request contains expected values.
      cy.wait('@updateBucketAccess');

      cy.findByText('Bucket access updated successfully.');
    });
  });
});
