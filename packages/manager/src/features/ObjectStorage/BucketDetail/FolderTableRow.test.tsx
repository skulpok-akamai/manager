import { render } from '@testing-library/react';
import * as React from 'react';

import { wrapWithTheme } from 'src/utilities/testHelpers';
import { Table } from 'src/components/Table';
import { TableBody } from 'src/components/TableBody';

import {
  FolderTableRow,
  Props,
} from 'src/features/ObjectStorage/BucketDetail/FolderTableRow';

describe('FolderTableRow', () => {
  it('renders a link with URI-encoded special characters', () => {
    const specialCharsProps: Props = {
      displayName: 'folder-with-special-chars...',
      folderName: 'folder-with-special-chars <>#%+{}|^[]`;?:@=&$',
      handleClickDelete: () => {},
      manuallyCreated: false,
    };

    const { getByRole } = render(
      wrapWithTheme(
        <Table>
          <TableBody>
            <FolderTableRow {...specialCharsProps} />
          </TableBody>
        </Table>
      )
    );

    expect(getByRole('link')).toHaveAttribute(
      'href',
      '/?prefix=folder-with-special-chars%20%3C%3E%23%25%2B%7B%7D%7C%5E%5B%5D%60%3B%3F%3A%40%3D%26%24'
    );
  });
});
