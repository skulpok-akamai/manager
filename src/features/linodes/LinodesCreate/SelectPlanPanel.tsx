import * as React from 'react';
import { isEmpty } from 'ramda';

import { withStyles, StyleRulesCallback, WithStyles, Theme } from 'material-ui';

import Grid from 'src/components/Grid';

import TabbedPanel from '../../../components/TabbedPanel';
import { Tab } from '../../../components/TabbedPanel/TabbedPanel';
import SelectionCard from '../../../components/SelectionCard';

export interface ExtendedType extends Linode.LinodeType {
  heading: string;
  subHeadings: [string, string];
}

type ClassNames = 'root';

const styles: StyleRulesCallback<ClassNames> = (theme: Theme & Linode.Theme) => ({
  root: {
    marginTop: theme.spacing.unit * 3,
  },
});

interface Props {
  types: ExtendedType[];
  error?: string;
  onSelect: (key: string) => void;
  selectedID: string | null;
  requiredDiskSpace?: number;
}

const getNanodes = (types: ExtendedType[]) =>
  types.filter(t => /nanode/.test(t.class));

const getStandard = (types: ExtendedType[]) =>
  types.filter(t => /standard/.test(t.class));

const getHighMem = (types: ExtendedType[]) =>
  types.filter(t => /highmem/.test(t.class));


class SelectPlanPanel extends React.Component<Props & WithStyles<ClassNames>> {
  renderCard = (selectedID: string|null, handleSelection: Function) =>
    (type: ExtendedType, idx: number) => {
      const requiredDiskSpace = this.props.requiredDiskSpace || 0;
      return <SelectionCard
        key={idx}
        checked={type.id === String(selectedID)}
        onClick={e => handleSelection(type.id)}
        heading={type.heading}
        subheadings={type.subHeadings}
        disabled={requiredDiskSpace > type.disk}
      />;
    }

  createTabs = () => {
    const { types } = this.props;
    const tabs: Tab[] = [];
    const nanodes = getNanodes(types);
    const standards = getStandard(types);
    const highmem = getHighMem(types);

    if (!isEmpty(nanodes)) {
      tabs.push({
        title: 'Nanode',
        render: () => {

          return (
            <Grid container spacing={16}>
            { nanodes.map(this.renderCard(this.props.selectedID, this.props.onSelect))}
            </Grid>
          );
        },
      });
    }

    if (!isEmpty(standards)) {
      tabs.push({
        title: 'Standard',
        render: () => {
          return (
            <Grid container spacing={16}>
              { standards.map(this.renderCard(this.props.selectedID, this.props.onSelect))}
            </Grid>
          );
        },
      });
    }

    if (!isEmpty(highmem)) {
      tabs.push({
        title: 'High Memory',
        render: () => {
          return (
            <Grid container spacing={16}>
              { highmem.map(this.renderCard(this.props.selectedID, this.props.onSelect))}
            </Grid>
          );
        },
      });
    }

    return tabs;
  }

  render() {
    return (
      <TabbedPanel
        rootClass={this.props.classes.root}
        error={this.props.error}
        header="Linode Plan"
        tabs={this.createTabs()}
        initTab={1}
      />
    );
  }
}

const styled = withStyles(styles, { withTheme: true });

export default styled(SelectPlanPanel);
