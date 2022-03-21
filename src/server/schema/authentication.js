import * as yup from 'yup';

export const NestedMFA = yup.object().shape({
  MFAType: yup.string().required(),
  MFAToken: yup.string().required(),
  clientTime: yup.string().optional(),
});

export default {

};
