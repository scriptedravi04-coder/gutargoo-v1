// Premium on web: a signed-in subscriber (premium on their number) can watch premium titles here too.
let pro = false;
export const isPro = () => pro;
export const setPro = (v: boolean) => {
  pro = v;
};
