import * as React from 'react';

import { Redirect } from 'react-router';

import { compose, pathOr } from 'ramda';

import { Subscription } from 'rxjs/Rx';

import { StyleRulesCallback, Theme, withStyles,  WithStyles } from '@material-ui/core/styles';

import Paper from '@material-ui/core/Paper';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Typography from '@material-ui/core/Typography';

import {
  _delete as deleteVolume,
  attach as attachtoLinode,
  clone as cloneVolume,
  create as createVolume,
  detach as detachVolume,
  getVolumes,
  resize as resizeVolume,
  update as updateVolume,
} from 'src/services/volumes';

import ActionsPanel from 'src/components/ActionsPanel';
import Button from 'src/components/Button';
import Grid from 'src/components/Grid';
import Table from 'src/components/Table';

import VolumeIcon from 'src/assets/addnewmenu/volume.svg';

import AddNewLink, { Props as AddNewLinkProps } from 'src/components/AddNewLink';
import ConfirmationDialog from 'src/components/ConfirmationDialog';
import ErrorState from 'src/components/ErrorState';
import Placeholder, { PlaceholderProps } from 'src/components/Placeholder';
import PromiseLoader, { PromiseLoaderResponse } from 'src/components/PromiseLoader';
import SectionErrorBoundary from 'src/components/SectionErrorBoundary';

import { events$, resetEventsPolling } from 'src/events';
import { getLinodeConfigs, getLinodeVolumes } from 'src/services/linodes';


import AttachVolumeDrawer from './AttachVolumeDrawer';
import ActionMenu from './LinodeVolumesActionMenu';
import UpdateVolumeDrawer, { Props as UpdateVolumeDrawerProps } from './UpdateVolumeDrawer';

import scrollErrorIntoView from 'src/utilities/scrollErrorIntoView';
import { withLinode, withVolumes } from '../context';

type ClassNames = 'title';

const styles: StyleRulesCallback<ClassNames> = (theme: Theme) => ({
  title: {
    marginTop: theme.spacing.unit,
    marginBottom: theme.spacing.unit * 2,
  },
});

interface Props {
  /** PromiseLoader */
  volumes: PromiseLoaderResponse<Linode.Volume[]>;
  linodeConfigs: PromiseLoaderResponse<Linode.Config[]>;
}

interface ContextProps {
  linodeVolumes: Linode.Volume[];
  linodeLabel: string;
  linodeRegion: string;
  linodeID: number;
}

interface AttachVolumeDrawerState {
  open: boolean;
  errors?: Linode.ApiFieldError[];
  selectedVolume: null | number;
}

interface UpdateDialogState {
  open: boolean;
  mode?: 'detach' | 'delete';
  id?: number;
}

interface UpdateVolumeDrawerState extends UpdateVolumeDrawerProps {
  mode?: 'create' | 'edit' | 'resize' | 'clone';
  id?: number;
}

interface State {
  attachedVolumes: Linode.Volume[];
  attachableVolumes: Linode.Volume[];
  attachVolumeDrawer: AttachVolumeDrawerState;
  updateDialog: UpdateDialogState;
  updateVolumeDrawer: UpdateVolumeDrawerState;
  redirect: boolean;
}

type CombinedProps = Props & ContextProps & WithStyles<ClassNames>;

export class LinodeVolumes extends React.Component<CombinedProps, State> {
  static defaultProps = {
    volumes: [],
    linodeConfigs: [],
  };

  static attachVolumeDrawerDefaultState = {
    open: false,
    selectedVolume: null,
  };

  static updateDialogDefaultState = {
    open: false,
  };

  static updateVolumeDrawerDefaultState = {
    open: false,
    label: '',
    title: '',
    linodeLabel: '',
    size: 0,
    region: '',
    linodeId: 0,
    onClose: () => null,
    onChange: () => null,
    onSubmit: () => null,
  };

  constructor(props: CombinedProps) {
    super(props);
    const { linodeVolumes } = props;

    this.state = {
      attachedVolumes: linodeVolumes,
      attachableVolumes: props.volumes.response,
      attachVolumeDrawer: LinodeVolumes.attachVolumeDrawerDefaultState,
      updateDialog: LinodeVolumes.updateDialogDefaultState,
      updateVolumeDrawer: LinodeVolumes.updateVolumeDrawerDefaultState,
      redirect: false,
    };
  }

  eventSubscription: Subscription;

  componentDidMount() {

    this.eventSubscription = events$
      /** @todo filter on mount time. */
      .filter(e => [
        'volume_attach',
        'volume_clone',
        'volume_create',
        'volume_delete',
        'volume_detach',
        'volume_resize',
      ].includes(e.action))
      .filter(e => !e._initial)
      .subscribe((v) => {
        this.getAllVolumes();
      });
  }

  componentWillUnmount() {
    this.eventSubscription.unsubscribe();
  }

  componentDidUpdate(prevProps: CombinedProps) {
    if (this.props.linodeVolumes !== prevProps.linodeVolumes) {
      this.setState({ attachedVolumes: this.props.linodeVolumes });
    }
  }

  getAllVolumes = () => {
    const { linodeRegion } = this.props;
    const getAttachedVolumes = getLinodeVolumes(this.props.linodeID)
      .then(response => response.data);
    const getAttachableVolumes = getVolumes()
      .then(response => response
        .data
        .filter(volume => volume.region === linodeRegion && volume.linode_id === null));

    Promise
      .all([
        getAttachedVolumes,
        getAttachableVolumes,
      ])
      .then(([attachedVolumes, attachableVolumes]) => {
        this.setState({
          attachedVolumes,
          attachableVolumes,
        });
      });
  }

  goToSettings = () => {
    this.setState({redirect: true});
  }

  /** Attachment */
  openAttachmentDrawer = () => this.setState(prevState => ({
    attachVolumeDrawer: {
      ...prevState.attachVolumeDrawer,
      open: true,
    },
  }))

  closeAttachmentDrawer = () => this.setState(prevState => ({
    attachVolumeDrawer: LinodeVolumes.attachVolumeDrawerDefaultState,
  }))

  attachVolume = () => {
    const { linodeID } = this.props;
    const { attachVolumeDrawer: { selectedVolume } } = this.state;

    if (!selectedVolume) {
      this.setState({
        attachVolumeDrawer: {
          ...this.state.attachVolumeDrawer,
          errors: [{ field: 'volume', reason: 'volume cannot be blank.' }],
        },
      }, () => {
        scrollErrorIntoView();
      });
      return;
    }

    attachtoLinode(Number(selectedVolume), { linode_id: Number(linodeID) })
      .then((response) => {
        this.closeAttachmentDrawer();
        resetEventsPolling();
      })
      .catch((error) => {
        this.setState({
          attachVolumeDrawer: {
            ...this.state.attachVolumeDrawer,
            errors: [{ field: 'volume', reason: 'Could not attach volume.' }],
          },
        }, () => {
          scrollErrorIntoView();
        });
      });
  }

  AttachVolumeDrawer = (): JSX.Element => {
    const { linodeLabel } = this.props;
    const {
      attachableVolumes,
      attachVolumeDrawer: {
        selectedVolume,
        open,
        errors,
      },
    } = this.state;

    return (
      <AttachVolumeDrawer
        open={open}
        linodeLabel={linodeLabel}
        volumes={attachableVolumes}
        errors={errors}
        selectedVolume={selectedVolume}
        onClose={this.closeAttachmentDrawer}
        onChange={(key, value) => this.setState({
          attachVolumeDrawer: {
            ...this.state.attachVolumeDrawer,
            [key]: value,
          },
        })}
        onSubmit={this.attachVolume}
      />
    );
  }

  /** Detachment / Deletion */
  openUpdateDialog = (mode: 'detach' | 'delete', id: number) => () => {
    this.setState({
      updateDialog: {
        mode,
        open: true,
        id,
      },
    });
  }

  closeUpdateDialog = () => {
    this.setState({
      updateDialog: LinodeVolumes.updateDialogDefaultState,
    });
  }

  detachVolume = () => {
    const { updateDialog: { id } } = this.state;
    if (!id) { return; }

    detachVolume(id)
      .then((response) => {
        this.closeUpdateDialog();
        resetEventsPolling();
      })
      .catch((response) => {
        /** @todo Error handling. */
      });
  }

  deleteVolume = () => {
    const { updateDialog: { id } } = this.state;
    if (!id) { return; }

    deleteVolume(id)
      .then((response) => {
        this.closeUpdateDialog();
        resetEventsPolling();
      })
      .catch((response) => {
        this.closeUpdateDialog();
        /** @todo Error handling */
      });
  }

  UpdateDialog = (): null | JSX.Element => {
    const {
      updateDialog: {
        mode,
        open,
      },
    } = this.state;

    if (!mode) { return null; }

    const method = (() => {
      switch (mode) {
        case 'detach': return this.detachVolume;
        case 'delete': return this.deleteVolume;
      }
    })();

    const title = (function () {
      switch (mode) {
        case 'detach': return 'Detach Volume';
        case 'delete': return 'Delete Volume';
      }
    })();

    return (
      <ConfirmationDialog
        onClose={this.closeUpdateDialog}
        actions={() => <div>
          <ActionsPanel style={{ padding: 0 }}>
            <Button
              type="secondary"
              destructive
              onClick={method}
              data-qa-confirm
            >
              Confirm
            </Button>
            <Button
              onClick={this.closeUpdateDialog}
              type="cancel"
              data-qa-cancel
            >
              Cancel
            </Button>
          </ActionsPanel>
        </div>}
        open={open}
        title={title}
      >
        <Typography> Are you sure you want to {mode} this volume?</Typography>
    </ConfirmationDialog>
    );
  }

  /** Create / Edit / Resize / Cloning */
  openUpdatingDrawer = (
    mode: 'create' | 'edit' | 'resize' | 'clone',
    id: number,
    label: string,
    size: number,
  ) => () => {
    const { linodeLabel, linodeRegion, linodeID } = this.props;

    switch (mode) {
      case 'create':
        return this.setState({
          updateVolumeDrawer: {
            open: true,
            label: '',
            title: 'Create a Volume',
            linodeLabel,
            size: 20,
            region: linodeRegion,
            linodeId: linodeID,
            disabled: { region: true, linode: true },
            onClose: this.closeUpdatingDrawer,
            onLabelChange: (label: string) => this.setState(prevState => ({
              updateVolumeDrawer: {
                ...prevState.updateVolumeDrawer,
                label,
              },
            })),
            onSizeChange: (size: string) => this.setState(prevState => ({
              updateVolumeDrawer: {
                ...prevState.updateVolumeDrawer,
                size: Number(size),
              },
            })),
            onSubmit: this.createVolume,
          },
        });

      case 'resize':
        return this.setState({
          updateVolumeDrawer: {
            open: true,
            id,
            label: label!,
            title: 'Resize a Volume',
            linodeLabel,
            size: size!,
            region: linodeRegion,
            linodeId: linodeID,
            disabled: { region: true, linode: true, label: true },
            onClose: this.closeUpdatingDrawer,
            onSizeChange: (size: string) => this.setState(prevState => ({
              updateVolumeDrawer: {
                ...prevState.updateVolumeDrawer,
                size: Number(size),
              },
            })),
            onSubmit: this.resizeVolume,
          },
        });

      case 'clone':
        return this.setState({
          updateVolumeDrawer: {
            open: true,
            id,
            label: label!,
            title: 'Clone a Volume',
            cloning: true,
            cloneLabel: '',
            linodeLabel,
            size: size!,
            region: linodeRegion,
            linodeId: linodeID,
            disabled: { region: true, linode: true, size: true, label: true },
            onClose: this.closeUpdatingDrawer,
            onCloneLabelChange: (cloneLabel: string) => this.setState(prevState => ({
              updateVolumeDrawer: {
                ...prevState.updateVolumeDrawer,
                cloneLabel,
              },
            })),
            onSubmit: this.cloneVolume,
          },
        });

      case 'edit':
        return this.setState({
          updateVolumeDrawer: {
            open: true,
            id,
            label: label!,
            title: 'Rename a Volume',
            linodeLabel,
            size: size!,
            region: linodeRegion,
            disabled: { region: true, linode: true, size: true },
            linodeId: linodeID,
            onClose: this.closeUpdatingDrawer,
            onLabelChange: (label: string) => this.setState(prevState => ({
              updateVolumeDrawer: {
                ...prevState.updateVolumeDrawer,
                label,
              },
            })),
            onSubmit: this.editVolume,
          },
        });

      default: return {};
    }
  }

  closeUpdatingDrawer = () => this.setState(prevState => ({
    updateVolumeDrawer: LinodeVolumes.updateVolumeDrawerDefaultState,
  }))

  createVolume = () => {
    const {
      updateVolumeDrawer: {
        label, size, region, linodeId,
      },
    } = this.state;

    if (!region || !linodeId) { return; }

    if (!label) {
      return this.setState({
        updateVolumeDrawer: {
          ...this.state.updateVolumeDrawer,
          errors: [{ field: 'label', reason: 'Label cannot be blank.' }],
        },
      }, () => {
        scrollErrorIntoView();
      });
    }

    if (!size) {
      return this.setState({
        updateVolumeDrawer: {
          ...this.state.updateVolumeDrawer,
          errors: [{ field: 'size', reason: 'cannot be blank.' }],
        },
      }, () => {
        scrollErrorIntoView();
      });
    }

    createVolume({
      label,
      size: Number(size),
      region,
      linode_id: linodeId,
    })
      .then(() => {
        this.closeUpdatingDrawer();
        this.getAllVolumes();
        resetEventsPolling();
      })
      .catch((errorResponse) => {
        this.setState({
          updateVolumeDrawer: {
            ...this.state.updateVolumeDrawer,
            errors: errorResponse.response.data.errors,
          },
        }, () => {
          scrollErrorIntoView();
        });
      });
  }

  editVolume = () => {
    const {
      updateVolumeDrawer: {
        id,
        label,
      },
    } = this.state;

    if (!id) {
      return;
    }

    if (!label) {
      return this.setState({
        updateVolumeDrawer: {
          ...this.state.updateVolumeDrawer,
          errors: [{ field: 'label', reason: 'Label cannot be blank.' }],
        },
      }, () => {
        scrollErrorIntoView();
      });
    }

    updateVolume(id, label)
      .then(() => {
        this.closeUpdatingDrawer();
        this.getAllVolumes();
      })
      .catch((errorResponse: any) => {
        this.setState({
          updateVolumeDrawer: {
            ...this.state.updateVolumeDrawer,
            errors: errorResponse.response.data.errors,
          },
        }, () => {
          scrollErrorIntoView();
        });
      });
  }

  resizeVolume = () => {
    const {
      updateVolumeDrawer: {
        id,
        size,
      },
    } = this.state;

    if (!id) {
      return;
    }

    if (!size) {
      return this.setState({
        updateVolumeDrawer: {
          ...this.state.updateVolumeDrawer,
          errors: [{ field: 'size', reason: 'Size cannot be blank.' }],
        },
      }, () => {
        scrollErrorIntoView();
      });
    }

    resizeVolume(id, Number(size))
      .then(() => {
        this.closeUpdatingDrawer();
        resetEventsPolling();
      })
      .catch((errorResponse: any) => {
        this.setState({
          updateVolumeDrawer: {
            ...this.state.updateVolumeDrawer,
            errors: errorResponse.response.data.errors.map(({ reason }: Linode.ApiFieldError) => ({
              field: 'size',
              reason,
            })),
          },
        }, () => {
          scrollErrorIntoView();
        });
      });
  }

  cloneVolume = () => {
    const { updateVolumeDrawer: { id, cloneLabel } } = this.state;

    if (!cloneLabel) {
      return this.setState({
        updateVolumeDrawer: {
          ...this.state.updateVolumeDrawer,
          errors: [{ field: 'label', reason: 'Label cannot be blank.' }],
        },
      }, () => {
        scrollErrorIntoView();
      });
    }

    if (!id) {
      return;
    }

    cloneVolume(id, cloneLabel)
      .then(() => {
        /**
         * @todo Now what? Per CF parity the volume is not automagically attached.
        */
        this.closeUpdatingDrawer();
        resetEventsPolling();
      })
      .catch((error) => {
        /** @todo Error handling. */
        this.setState({
          updateVolumeDrawer: {
            ...this.state.updateVolumeDrawer,
            errors: error.response.data.errors,
          },
        }, () => {
          scrollErrorIntoView();
        });
      });
  }

  /**
   * Only ever show if the Linode has attached volumes.
   *
   * IconTextLink is
   *  - If user has no configs, show null.
   *  - Else
   *    - If User has eligible volumes, show "Attach a Volume"
   *    - Else show "Create a Volume"
   */
  IconTextLink = (): null | JSX.Element => {
    const { linodeConfigs: { response: configs } } = this.props;
    const { attachableVolumes } = this.state;

    if (configs.length === 0) {
      return null;
    }

    let IconTextLinkProps: AddNewLinkProps = {
      onClick: this.openUpdatingDrawer('create', 0, '', 0),
      label: 'Create a Volume',
    };

    if (attachableVolumes.length > 0) {
      IconTextLinkProps = {
        onClick: this.openAttachmentDrawer,
        label: 'Attach Existing Volume',
      };
    }
    return <AddNewLink {...IconTextLinkProps} />;
  }

  /**
   * Placeholder is
   * - If Linode has volumes, null.
   *  - Else
   *    - If user has no configs, show "View Linode Config"
   *    - Else
   *      - If user has eligible Volumes, show "Attach a Volume"
   *      - Else, show "Create a Volume"
   */
  Placeholder = (): null | JSX.Element => {
    const {
      linodeConfigs: { response: configs },
    } = this.props;
    const { attachedVolumes, attachableVolumes } = this.state;
    let props: PlaceholderProps;

    if (attachedVolumes.length > 0) {
      return null;
    }

    if (configs.length === 0) {
      props = {
        buttonProps: {
          onClick: this.goToSettings,
          children: 'View Linode Config',
        },
        icon: VolumeIcon,
        title: 'No configs available',
        copy: 'This Linode has no configurations. Click below to create a configuration.',
      };
      return <Placeholder {...props} />;
    }

    if (attachableVolumes.length > 0) {
      props = {
        buttonProps: {
          onClick: this.openAttachmentDrawer,
          children: 'Attach a Volume',
        },
        icon: VolumeIcon,
        title: 'No volumes attached',
        copy: 'Click below to attach a volume.',
      };
      return < Placeholder {...props} />;
    }

    /** We have at least one config, but we have no volumes. */
    props = {
      buttonProps: {
        onClick: this.openUpdatingDrawer('create', 0, '', 0),
        children: 'Create a Volume',
      },
      icon: VolumeIcon,
      title: 'No volumes found',
      copy: 'Click below to create a volume.',
    };

    return <Placeholder {...props} />;
  }

  /**
   * Table is
   * - If Linode has no volumes, null.
   * - Else show rows of volumes.
   */
  Table = (): null | JSX.Element => {
    const { classes } = this.props;
    const { attachedVolumes } = this.state;

    if (attachedVolumes.length === 0) {
      return null;
    }

    return (
      <React.Fragment>
        <Grid container justify="space-between" alignItems="flex-end">
          <Grid item>
            <Typography
              variant="headline"
              className={classes.title}
              data-qa-title>
              Attached Volumes
            </Typography>
          </Grid>
          <Grid item>
            <this.IconTextLink />
          </Grid>
        </Grid>
        <Paper>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Label</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>File System Path</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {
                attachedVolumes!.map((volume) => {
                  /** @todo Remove path defaulting when API releases filesystem_path. */
                  const label = pathOr('', ['label'], volume);
                  const size = pathOr('', ['size'], volume);
                  const filesystem_path = pathOr(
                    `/dev/disk/by-id/scsi-0Linode_Volume_${label}`,
                    ['filesystem_path'],
                    volume,
                  );

                  return <TableRow key={volume.id} data-qa-volume-cell={volume.id}>
                    <TableCell data-qa-volume-cell-label>{label}</TableCell>
                    <TableCell data-qa-volume-size>{size} GiB</TableCell>
                    <TableCell data-qa-fs-path>{filesystem_path}</TableCell>
                    <TableCell>
                      <ActionMenu
                        volumeId={volume.id}
                        onDetach={this.openUpdateDialog('detach', volume.id)}
                        onDelete={this.openUpdateDialog('delete', volume.id)}
                        onClone={this.openUpdatingDrawer(
                          'clone',
                          volume.id,
                          volume.label,
                          volume.size,
                        )}
                        onEdit={this.openUpdatingDrawer(
                          'edit',
                          volume.id,
                          volume.label,
                          volume.size,
                        )}
                        onResize={this.openUpdatingDrawer(
                          'resize',
                          volume.id,
                          volume.label,
                          volume.size,
                        )}
                      />
                    </TableCell>
                  </TableRow>;
                })
              }
            </TableBody>
          </Table>
        </Paper>
        <this.UpdateDialog />
      </React.Fragment>
    );
  }

  /**
   * Important numbers;
   * number of configs
   * number of this linodes volumes
   * number of eligible volumes
   */
  render() {
    const {
      volumes: { error: volumesError },
      linodeConfigs: { error: linodeConfigsError },
    } = this.props;

    const { updateVolumeDrawer } = this.state;

    if (this.state.redirect) {
      return <Redirect push to="settings" />;
    }
  

    if (volumesError || linodeConfigsError) {
      return <ErrorState errorText="An error has occured." />;
    }

    return (
      <React.Fragment>
        <this.Placeholder />
        <this.Table />
        <this.AttachVolumeDrawer />
        <UpdateVolumeDrawer {...updateVolumeDrawer} />
      </React.Fragment>
    );
  }
}

const styled = withStyles(styles, { withTheme: true });

const preloaded = PromiseLoader<Props & ContextProps>({
  linodeConfigs: (props) => getLinodeConfigs(props.linodeID)
    .then(response => response.data),

  volumes: (props) => getVolumes()
    .then(response => response.data
      .filter(volume => volume.region === props.linodeRegion && volume.linode_id === null)),
});

const linodeContext = withLinode((context) => ({
  linodeID: context.data!.id,
  linodeLabel: context.data!.label,
  linodeRegion: context.data!.region,
}));

const volumesContext = withVolumes((context) => ({
  linodeVolumes: context.data,
}));

export default compose<any, any, any, any, any, any>(
  linodeContext,
  volumesContext,
  styled,
  SectionErrorBoundary,
  preloaded,
)(LinodeVolumes);
